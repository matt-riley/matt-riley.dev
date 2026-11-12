/** A single moving front switches the authored bays in entrance-to-gift order. */
export class NightSweep {
  private from: number;
  private to: number;
  private started = -Infinity;

  constructor(night: boolean) {
    this.from = this.to = Number(night);
  }

  setNight(night: boolean, now: number) {
    const target = Number(night);
    if (target === this.to) return;
    this.from = this.sample(now).amount;
    this.to = target;
    this.started = now;
  }

  sample(now: number) {
    const progress = Math.max(0, Math.min(1, (now - this.started) / 900));
    const eased = progress * progress * (3 - 2 * progress);
    return {
      from: this.from,
      to: this.to,
      front: -0.08 + eased * 1.16,
      amount: this.from + (this.to - this.from) * eased,
      moving: progress < 1,
    };
  }
}
