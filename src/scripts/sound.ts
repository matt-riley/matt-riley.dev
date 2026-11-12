export interface SoundEngine {
  context: BaseAudioContext;
  input: GainNode;
  output: WaveShaperNode;
  clink(pitch?: number): void;
  slide(): void;
  switchFlick(): void;
  flap(): void;
  key(): void;
  purr(): void;
  roomTone(on: boolean): void;
  stopPurr(): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/** No browser globals or AudioContext are touched until explicitly mounted. */
export function createSoundEngine(
  context: BaseAudioContext,
  enabled: () => boolean,
): SoundEngine {
  const input = context.createGain(),
    compressor = context.createDynamicsCompressor(),
    output = context.createWaveShaper();
  input.gain.value = 0.14;
  compressor.threshold.value = -18;
  compressor.knee.value = 8;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.001;
  compressor.release.value = 0.08;
  // The final sample ceiling is .45 (-6.94dBFS), even if voices overlap.
  output.curve = Float32Array.from({ length: 1025 }, (_, index) =>
    Math.max(-0.45, Math.min(0.45, index / 512 - 1)),
  );
  output.oversample = "none";
  input.connect(compressor).connect(output).connect(context.destination);
  const active = new Map<
    AudioScheduledSourceNode,
    { kind: string; release: () => void }
  >();
  const last = new Map<string, number>();
  let lastAny = -Infinity,
    muted = false,
    disposed = false;
  let buffer: AudioBuffer | undefined, room: AudioBufferSourceNode | undefined;
  const randomPitch = () => 0.985 + Math.random() * 0.03;
  function permit(kind: string, interval = 0.05) {
    const now = context.currentTime;
    if (
      disposed ||
      muted ||
      !enabled() ||
      now - lastAny < 0.025 ||
      now - (last.get(kind) ?? -Infinity) < interval
    )
      return false;
    last.set(kind, now);
    lastAny = now;
    return true;
  }
  function track(
    source: AudioScheduledSourceNode,
    kind: string,
    nodes: AudioNode[],
  ) {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      source.onended = null;
      source.disconnect();
      nodes.forEach((node) => {
        node.disconnect();
      });
      active.delete(source);
    };
    active.set(source, { kind, release });
    source.onended = release;
  }
  function stop(kind?: string) {
    for (const [source, state] of active)
      if (!kind || state.kind === kind) {
        try {
          source.stop();
        } catch {
          /* Already ended. */
        }
        state.release();
      }
    if (!kind || kind === "room") room = undefined;
  }
  function envelope(
    gain: GainNode,
    level: number,
    at: number,
    duration: number,
    attack = 0.002,
  ) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  }
  function tone(
    kind: string,
    frequency: number,
    duration: number,
    level: number,
    at = context.currentTime,
    type: OscillatorType = "sine",
  ) {
    const source = context.createOscillator(),
      gain = context.createGain();
    source.type = type;
    source.frequency.value = frequency;
    envelope(gain, level, at, duration);
    source.connect(gain).connect(input);
    track(source, kind, [gain]);
    source.start(at);
    source.stop(at + duration + 0.01);
  }
  function noise(
    kind: string,
    frequency: number,
    duration: number,
    level: number,
    at = context.currentTime,
    type: BiquadFilterType = "bandpass",
    attack = 0.003,
  ) {
    if (!buffer) {
      buffer = context.createBuffer(
        1,
        context.sampleRate * 2,
        context.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++)
        samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    source.connect(filter).connect(gain).connect(input);
    if (duration) envelope(gain, level, at, duration, attack);
    else {
      source.loop = true;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 2);
    }
    track(source, kind, [filter, gain]);
    source.start(at, Math.random() * 0.3);
    if (duration) source.stop(at + duration + 0.01);
    return source;
  }
  const engine: SoundEngine = {
    context,
    input,
    output,
    clink(pitch = 1) {
      if (!permit("clink")) return;
      const p = pitch * randomPitch();
      tone("clink", 1120 * p, 0.14, 0.3);
      tone("clink", 1687 * p, 0.11, 0.12);
      tone("clink", 2641 * p, 0.08, 0.07);
      noise("clink", 4200, 0.025, 0.035, context.currentTime, "highpass");
    },
    slide() {
      if (permit("slide", 0.12))
        noise(
          "slide",
          850 * randomPitch(),
          0.24,
          0.23,
          context.currentTime,
          "bandpass",
          0.035,
        );
    },
    switchFlick() {
      if (!permit("switch", 0.07)) return;
      tone(
        "switch",
        145 * randomPitch(),
        0.06,
        0.2,
        context.currentTime,
        "triangle",
      );
      tone(
        "switch",
        2100 * randomPitch(),
        0.024,
        0.045,
        context.currentTime + 0.035,
      );
    },
    flap() {
      if (!permit("flap", 0.2)) return;
      noise("flap", 1700, 0.04, 0.12);
      noise("flap", 2400, 0.025, 0.05, context.currentTime + 0.05);
    },
    key() {
      if (!permit("key", 0.025)) return;
      tone(
        "key",
        330 * randomPitch(),
        0.035,
        0.045,
        context.currentTime,
        "triangle",
      );
      noise("key", 1100, 0.025, 0.03);
    },
    purr() {
      if (!permit("purr", 1.5)) return;
      const at = context.currentTime,
        carrier = context.createOscillator(),
        mod = context.createOscillator(),
        depth = context.createGain(),
        amplitude = context.createGain(),
        gain = context.createGain();
      carrier.frequency.value = 57 * randomPitch();
      mod.frequency.value = 24;
      depth.gain.value = 0.025;
      amplitude.gain.value = 0.06;
      envelope(gain, 1, at, 1.5, 0.05);
      mod.connect(depth).connect(amplitude.gain);
      carrier.connect(amplitude).connect(gain).connect(input);
      track(carrier, "purr", [amplitude, gain]);
      track(mod, "purr", [depth]);
      carrier.start(at);
      mod.start(at);
      carrier.stop(at + 1.5);
      mod.stop(at + 1.5);
    },
    roomTone(on) {
      if (!on || !enabled() || muted) {
        stop("room");
        return;
      }
      if (!room)
        room = noise("room", 280, 0, 0.012, context.currentTime, "lowpass");
    },
    stopPurr() {
      stop("purr");
    },
    setMuted(value) {
      muted = value;
      input.gain.cancelScheduledValues(context.currentTime);
      input.gain.setValueAtTime(value ? 0 : 0.14, context.currentTime);
      if (value) stop();
      else {
        last.clear();
        lastAny = -Infinity;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      input.disconnect();
      compressor.disconnect();
      output.disconnect();
    },
  };
  return engine;
}

export function mountSound(context: AudioContext) {
  const root = document.documentElement;
  const enabled = () =>
    root.dataset.sound === "on" &&
    !document.hidden &&
    context.state === "running";
  const engine = createSoundEngine(context, enabled);
  const room = () =>
    engine.roomTone(enabled() && root.dataset.lights === "after-hours");
  function touch(event: Event) {
    if (!enabled()) return;
    const { exhibit, model } = (event as CustomEvent).detail ?? {};
    if (model === "cat" || exhibit === "cat") {
      if (root.dataset.cat === "on") engine.purr();
      return;
    }
    if (model === "boom-bap" || model === "absent") return;
    if (["tools", "agent-skills", "entrance"].includes(exhibit)) engine.slide();
    else if (exhibit === "flagz") engine.switchFlick();
    else if (exhibit === "acquisitions") engine.flap();
    else if (exhibit === "waffle-agent") engine.key();
    else engine.clink(0.9 + Math.random() * 0.2);
  }
  function setting(event: Event) {
    const { key, value } = (event as CustomEvent).detail ?? {};
    if (key === "cat" && value === "off") engine.stopPurr();
    if (key === "sound") engine.setMuted(value !== "on");
    else if (key === "lights" || key === "cat") engine.switchFlick();
    room();
  }
  const character = (event: Event) => {
    if ((event as CustomEvent).detail?.typing) engine.key();
  };
  document.addEventListener("mr:touch", touch);
  document.addEventListener("mr:setting", setting);
  document.addEventListener("mr:waffle-character", character);
  room();
  return {
    engine,
    touch,
    refresh: room,
    dispose() {
      document.removeEventListener("mr:touch", touch);
      document.removeEventListener("mr:setting", setting);
      document.removeEventListener("mr:waffle-character", character);
      engine.dispose();
    },
  };
}
