export type QualityTier = "high" | "medium" | "low" | "retreat";

/** Count active moving time across short camera dwells; true idle resets the episode. */
export class QualityMonitor {
  tier: QualityTier;
  average = 0;
  private samples: { time: number; duration: number }[] = [];
  private slowDuration = 0;
  private lastMoving: number | undefined;

  constructor(concurrency = 8, memory = 8) {
    this.tier = concurrency <= 4 || memory <= 4 ? "medium" : "high";
  }

  sample(time: number, duration: number, moving: boolean) {
    if (!moving || duration <= 0) {
      if (this.lastMoving !== undefined && time - this.lastMoving > 1000) {
        this.samples = [];
        this.slowDuration = 0;
      }
      return false;
    }
    this.lastMoving = time;
    this.samples.push({ time, duration });
    this.samples = this.samples.filter((sample) => time - sample.time <= 1000);
    this.average =
      this.samples.reduce((sum, sample) => sum + sample.duration, 0) /
      this.samples.length;
    const threshold = this.tier === "low" ? 33 : 20;
    if (this.tier === "retreat" || this.average <= threshold) {
      this.slowDuration = 0;
      return false;
    }
    this.slowDuration += duration;
    if (this.slowDuration < (this.tier === "low" ? 3000 : 2000)) return false;
    this.tier =
      this.tier === "high"
        ? "medium"
        : this.tier === "medium"
          ? "low"
          : "retreat";
    this.samples = [];
    this.slowDuration = 0;
    return true;
  }
}
