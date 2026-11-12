export interface ScheduledStep {
  step: number;
  when: number;
}

/** Timer wakes fill a look-ahead queue; only AudioContext time defines deadlines. */
export class StepTimeline {
  private next: number;
  private index = 0;
  missed = 0;
  tempo: number;
  swing: number;
  constructor(startTime: number, tempo = 88, swing = 58) {
    if (!Number.isFinite(startTime))
      throw new RangeError("Invalid audio start time");
    this.next = startTime;
    this.tempo = tempo;
    this.swing = swing;
    this.setTiming(tempo, swing);
  }
  setTiming(tempo: number, swing: number) {
    if (
      !Number.isFinite(tempo) ||
      tempo < 70 ||
      tempo > 110 ||
      !Number.isFinite(swing) ||
      swing < 50 ||
      swing > 66
    )
      throw new RangeError("Invalid drum timing");
    this.tempo = tempo;
    this.swing = swing;
  }
  takeUntil(now: number, horizon = 0.15): ScheduledStep[] {
    if (
      !Number.isFinite(now) ||
      !Number.isFinite(horizon) ||
      horizon <= 0 ||
      horizon > 1
    )
      throw new RangeError("Invalid scheduling window");
    const pair = 30 / this.tempo;
    const skipPairs = Math.max(0, Math.floor((now - this.next) / pair) - 1);
    this.index += skipPairs * 2;
    this.next += skipPairs * pair;
    this.missed += skipPairs * 2;
    const notes: ScheduledStep[] = [];
    while (this.next < now + horizon) {
      const step = this.index % 16;
      if (this.next >= now - 1e-8) notes.push({ step, when: this.next });
      else this.missed++;
      this.next +=
        (60 / this.tempo / 4) *
        (step % 2 === 0 ? this.swing / 50 : (100 - this.swing) / 50);
      this.index++;
    }
    return notes;
  }
}
