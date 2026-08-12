/**
 * In-memory token-bucket rate limiter.
 *
 * SPEC §26 requires rate limits on sensitive endpoints; before this, nothing
 * in the app was limited — a client could hammer `match:submit` (a DB read +
 * full puzzle fetch + validation each time, which doubles as an unlimited
 * correctness oracle), spam `queue:join` upserts, or mint unlimited users via
 * the passwordless login.
 *
 * Process-local, like realtime/state.ts — correct for the single-process
 * local build, and the seam to swap for Redis if this ever runs multi-instance.
 */

export interface RateLimitRule {
  /** Bucket capacity — the largest burst allowed. */
  burst: number;
  /** Sustained rate at which the bucket refills. */
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Milliseconds until one more token is available. 0 when allowed. */
  retryAfterMs: number;
}

/** Buckets untouched for this long are dropped, so the map can't grow forever. */
const IDLE_EVICTION_MS = 10 * 60 * 1000;

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly rules: Record<string, RateLimitRule>) {}

  /**
   * Consumes one token for `key` under `ruleName`. An unknown rule name is
   * allowed through rather than throwing — a limiter must never be the thing
   * that breaks a request path.
   */
  check(ruleName: string, key: string, now: number = Date.now()): RateLimitDecision {
    const rule = this.rules[ruleName];
    if (!rule) return { allowed: true, retryAfterMs: 0 };

    const bucketKey = `${ruleName}:${key}`;
    const bucket = this.buckets.get(bucketKey) ?? { tokens: rule.burst, lastRefillMs: now };

    const elapsedMs = Math.max(0, now - bucket.lastRefillMs);
    bucket.tokens = Math.min(rule.burst, bucket.tokens + (elapsedMs / 1000) * rule.refillPerSecond);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      this.buckets.set(bucketKey, bucket);
      const retryAfterMs = Math.ceil(((1 - bucket.tokens) / rule.refillPerSecond) * 1000);
      return { allowed: false, retryAfterMs };
    }

    bucket.tokens -= 1;
    this.buckets.set(bucketKey, bucket);
    this.evictIdle(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Drops a key's buckets — e.g. when a socket disconnects for good. */
  forget(key: string): void {
    for (const bucketKey of this.buckets.keys()) {
      if (bucketKey.endsWith(`:${key}`)) this.buckets.delete(bucketKey);
    }
  }

  /** Test/introspection helper. */
  size(): number {
    return this.buckets.size;
  }

  private evictIdle(now: number): void {
    if (this.buckets.size < 512) return; // cheap: only sweep once the map is actually large
    for (const [bucketKey, bucket] of this.buckets) {
      if (now - bucket.lastRefillMs > IDLE_EVICTION_MS) this.buckets.delete(bucketKey);
    }
  }
}

/**
 * Realtime limits. `progress` is generous because it legitimately fires on
 * every keystroke; `submit` is tight because each call costs a puzzle fetch +
 * validation and would otherwise be a free correctness oracle.
 */
export const REALTIME_RATE_LIMITS: Record<string, RateLimitRule> = {
  "queue:join": { burst: 5, refillPerSecond: 0.5 },
  "queue:leave": { burst: 5, refillPerSecond: 0.5 },
  "match:progress": { burst: 40, refillPerSecond: 10 },
  "match:submit": { burst: 6, refillPerSecond: 1 },
};

/** Server-action limits: puzzle handout, practice grading, and passwordless login. */
export const ACTION_RATE_LIMITS: Record<string, RateLimitRule> = {
  "practice:start": { burst: 10, refillPerSecond: 0.5 },
  "practice:submit": { burst: 15, refillPerSecond: 1 },
  login: { burst: 8, refillPerSecond: 0.2 },
};

export const actionRateLimiter = new RateLimiter(ACTION_RATE_LIMITS);
