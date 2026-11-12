import { type ScheduledStep, StepTimeline } from "./drum-clock";
import type { DrumPattern } from "./drum-pattern";
import type { SoundEngine } from "./sound";

export function createDrumVoices(engine: SoundEngine) {
  const context = engine.context,
    bus = context.createGain(),
    saturation = context.createWaveShaper(),
    filter = context.createBiquadFilter();
  bus.gain.value = 0.7;
  saturation.curve = Float32Array.from(
    { length: 1025 },
    (_, index) => Math.tanh((index / 512 - 1) * 1.4) / Math.tanh(1.4),
  );
  saturation.oversample = "2x";
  filter.type = "lowpass";
  filter.frequency.value = Math.min(9000, context.sampleRate / 2 - 1);
  bus.connect(saturation).connect(filter).connect(engine.input);
  let noise: AudioBuffer | undefined;
  const voices = new Map<
    AudioScheduledSourceNode,
    {
      release: () => void;
      open?: { gain: GainNode; start: number; end: number };
    }
  >();
  function track(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
    open?: { gain: GainNode; start: number; end: number },
  ) {
    let ended = false;
    const release = () => {
      if (ended) return;
      ended = true;
      source.onended = null;
      source.disconnect();
      nodes.forEach((node) => {
        node.disconnect();
      });
      voices.delete(source);
    };
    voices.set(source, { release, open });
    source.onended = release;
  }
  function envelope(
    gain: GainNode,
    when: number,
    duration: number,
    peak: number,
  ) {
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  }
  function tone(
    frequency: number,
    when: number,
    duration: number,
    peak: number,
    drop?: number,
  ) {
    const source = context.createOscillator(),
      gain = context.createGain();
    source.frequency.setValueAtTime(frequency, when);
    if (drop) source.frequency.exponentialRampToValueAtTime(drop, when + 0.085);
    envelope(gain, when, duration, peak);
    source.connect(gain).connect(bus);
    track(source, [gain]);
    source.start(when);
    source.stop(when + duration + 0.01);
  }
  function hiss(
    when: number,
    duration: number,
    peak: number,
    cutoff: number,
    type: BiquadFilterType,
    open = false,
  ) {
    if (!noise) {
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let index = 0; index < samples.length; index++)
        samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = noise;
    filter.type = type;
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    envelope(gain, when, duration, peak);
    source.connect(filter).connect(gain).connect(bus);
    track(
      source,
      [filter, gain],
      open ? { gain, start: when, end: when + duration } : undefined,
    );
    source.start(when, Math.random() * 0.2);
    source.stop(when + duration + 0.01);
  }
  function choke(when: number) {
    for (const [source, voice] of voices) {
      if (!voice.open || voice.open.start > when || voice.open.end <= when)
        continue;
      voice.open.gain.gain.cancelAndHoldAtTime(when);
      voice.open.gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.005);
      source.stop(when + 0.007);
      voice.open.end = when + 0.007;
    }
  }
  function stop() {
    for (const [source, voice] of voices) {
      try {
        source.stop();
      } catch {
        /* Already stopped. */
      }
      voice.release();
    }
  }
  return {
    play(row: number, when: number) {
      if (row === 0) {
        tone(120, when, 0.34, 0.9, 45);
        hiss(when, 0.018, 0.035, 3200, "highpass");
      } else if (row === 1) {
        tone(180, when, 0.12, 0.16);
        hiss(when, 0.18 + Math.random() * 0.025, 0.44, 1700, "bandpass");
      } else if (row === 2) {
        choke(when);
        hiss(when, 0.055, 0.18, 7000, "highpass");
      } else if (row === 3) hiss(when, 0.36, 0.13, 6500, "highpass", true);
    },
    stop,
    dispose() {
      stop();
      bus.disconnect();
      saturation.disconnect();
      filter.disconnect();
      noise = undefined;
    },
  };
}

/** A 25ms timer only fills the queue; start(when) uses the audio clock. */
export function createSequencer(
  engine: SoundEngine,
  pattern: () => DrumPattern,
  callbacks: { step: (note: ScheduledStep) => void; stopped?: () => void },
) {
  const voices = createDrumVoices(engine),
    context = engine.context;
  let timeline: StepTimeline | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    playing = false;
  function stop() {
    const wasPlaying = playing;
    playing = false;
    clearTimeout(timer);
    timer = undefined;
    voices.stop();
    if (wasPlaying) callbacks.stopped?.();
  }
  function pump() {
    if (!playing || !timeline) return;
    if (context.state !== "running") {
      stop();
      return;
    }
    const current = pattern();
    timeline.setTiming(current.tempo, current.swing);
    for (const note of timeline.takeUntil(context.currentTime)) {
      current.rows.forEach((mask, row) => {
        if (
          mask & (1 << note.step) &&
          !(row === 3 && current.rows[2] & (1 << note.step))
        )
          voices.play(row, note.when);
      });
      callbacks.step(note);
    }
    timer = setTimeout(pump, 25);
  }
  return {
    get playing() {
      return playing;
    },
    get missed() {
      return timeline?.missed ?? 0;
    },
    start() {
      if (playing) return;
      const current = pattern();
      timeline = new StepTimeline(
        context.currentTime + 0.05,
        current.tempo,
        current.swing,
      );
      playing = true;
      pump();
    },
    stop,
    dispose() {
      stop();
      voices.dispose();
    },
  };
}
