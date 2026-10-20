export class PerformanceGovernor {
  constructor(quality = "low") {
    this.samples = [];
    this.since = 0;
    this.quality = quality;
  }
  sample(milliseconds, now) {
    // Count slow frames too: discarding >250ms prevented weak GPUs ever
    // reaching the sample threshold. Ignore only long background-tab gaps.
    if (!(milliseconds > 0 && milliseconds < 2000)) return null;
    if (!this.since) this.since = now;
    this.samples.push(milliseconds);
    if (this.samples.length > 180) this.samples.shift();
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const severe =
      this.quality !== "low" &&
      this.samples.length >= 6 &&
      now - this.since >= 1500 &&
      mean > 45;
    if (!severe && (now - this.since < 8000 || this.samples.length < 90))
      return null;
    this.since = now;
    const next = mean > 30 ? "low" : mean < 19 ? "medium" : this.quality;
    this.samples = [];
    if (next === this.quality) return null;
    return (this.quality = next);
  }
}
