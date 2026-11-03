// A minimal token bucket. Extracted from source-adapters/base.ts (Sprint E
// email-engine work) so both job-source adapters and the new web-fetch
// client (org-website discovery, Sprint E) share one implementation rather
// than two independently-drifting copies. Behaviour is unchanged —
// base.ts re-imports this class rather than keeping its own.
//
// Intentionally in-process only — Phase 1 is a single-instance personal
// system, not a distributed one, so a shared (Redis-backed) bucket is out
// of scope until that changes.
export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private lastRefill: number;

  constructor(requestsPerMinute: number) {
    this.capacity = Math.max(1, requestsPerMinute);
    this.tokens = this.capacity;
    this.refillPerMs = this.capacity / 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.max(10, (1 - this.tokens) / this.refillPerMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
