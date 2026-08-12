import { describe, expect, it } from "vitest";
import { RateLimiter, REALTIME_RATE_LIMITS } from "./rateLimit";

describe("RateLimiter", () => {
  it("allows a full burst then blocks", () => {
    const limiter = new RateLimiter({ test: { burst: 3, refillPerSecond: 1 } });
    const now = 1_000_000;

    expect(limiter.check("test", "user", now).allowed).toBe(true);
    expect(limiter.check("test", "user", now).allowed).toBe(true);
    expect(limiter.check("test", "user", now).allowed).toBe(true);
    expect(limiter.check("test", "user", now).allowed).toBe(false);
  });

  it("refills over time", () => {
    const limiter = new RateLimiter({ test: { burst: 2, refillPerSecond: 1 } });
    const now = 1_000_000;

    limiter.check("test", "user", now);
    limiter.check("test", "user", now);
    expect(limiter.check("test", "user", now).allowed).toBe(false);

    // One second later, exactly one token is back.
    expect(limiter.check("test", "user", now + 1000).allowed).toBe(true);
    expect(limiter.check("test", "user", now + 1000).allowed).toBe(false);
  });

  it("never refills past the burst ceiling", () => {
    const limiter = new RateLimiter({ test: { burst: 2, refillPerSecond: 1 } });
    const now = 1_000_000;

    limiter.check("test", "user", now);
    // An hour of idling still only buys `burst` calls, not 3600.
    expect(limiter.check("test", "user", now + 3_600_000).allowed).toBe(true);
    expect(limiter.check("test", "user", now + 3_600_000).allowed).toBe(true);
    expect(limiter.check("test", "user", now + 3_600_000).allowed).toBe(false);
  });

  it("reports a usable retryAfterMs when blocked", () => {
    const limiter = new RateLimiter({ test: { burst: 1, refillPerSecond: 2 } });
    const now = 1_000_000;

    limiter.check("test", "user", now);
    const blocked = limiter.check("test", "user", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    // Waiting exactly that long makes the next call succeed.
    expect(limiter.check("test", "user", now + blocked.retryAfterMs).allowed).toBe(true);
  });

  it("keys buckets per user and per rule", () => {
    const limiter = new RateLimiter({
      a: { burst: 1, refillPerSecond: 1 },
      b: { burst: 1, refillPerSecond: 1 },
    });
    const now = 1_000_000;

    expect(limiter.check("a", "alice", now).allowed).toBe(true);
    expect(limiter.check("a", "alice", now).allowed).toBe(false);
    // Bob is unaffected by Alice exhausting her bucket...
    expect(limiter.check("a", "bob", now).allowed).toBe(true);
    // ...and so is Alice's separate rule-b bucket.
    expect(limiter.check("b", "alice", now).allowed).toBe(true);
  });

  it("allows unknown rules through rather than throwing", () => {
    const limiter = new RateLimiter({});
    expect(limiter.check("not-configured", "user").allowed).toBe(true);
  });

  it("forgets a key's buckets", () => {
    const limiter = new RateLimiter({ test: { burst: 1, refillPerSecond: 0.01 } });
    const now = 1_000_000;

    limiter.check("test", "user", now);
    expect(limiter.check("test", "user", now).allowed).toBe(false);

    limiter.forget("user");
    expect(limiter.size()).toBe(0);
    expect(limiter.check("test", "user", now).allowed).toBe(true);
  });

  it("configures every realtime client event", () => {
    // A missing rule silently disables limiting for that event, so pin the list.
    expect(Object.keys(REALTIME_RATE_LIMITS).sort()).toEqual([
      "match:progress",
      "match:submit",
      "queue:join",
      "queue:leave",
    ]);
  });

  it("permits a realistic keystroke rate on match:progress", () => {
    const limiter = new RateLimiter(REALTIME_RATE_LIMITS);
    let now = 1_000_000;
    // ~7 edits/second for 20 seconds — fast human typing, must not be limited.
    for (let i = 0; i < 140; i++) {
      expect(limiter.check("match:progress", "user", now).allowed).toBe(true);
      now += 143;
    }
  });
});
