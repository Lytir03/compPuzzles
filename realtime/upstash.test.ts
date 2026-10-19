import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimOnce,
  checkDistributedRateLimit,
  clearLocalStore,
  getRevocationCutoff,
  getValues,
  isRevoked,
  realtimeRedisKey,
  setExpiringValue,
} from "./upstash";

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.stubEnv("REALTIME_REDIS_KEY_SECRET", "test-key-secret-with-enough-entropy");
  clearLocalStore();
});

describe("realtime Upstash adapter", () => {
  it("claims a JTI exactly once", async () => {
    const key = realtimeRedisKey("jti", "ticket-id");
    expect(await claimOnce(key, 120)).toBe(true);
    expect(await claimOnce(key, 120)).toBe(false);
  });

  it("uses the agreed HMAC-prefixed revocation keys without exposing ids", () => {
    const raw = "sensitive-session-id";
    const key = realtimeRedisKey("sid", raw);
    expect(key).toMatch(/^cp:rt:revoked:sid:[0-9a-f]{64}$/);
    expect(key).not.toContain(raw);
  });

  it("reads an expiring revocation marker", async () => {
    const key = realtimeRedisKey("sid", "session-id");
    expect(await isRevoked(key)).toBe(false);
    expect(await setExpiringValue(key, "1", 60_000)).toBe(true);
    expect(await isRevoked(key)).toBe(true);
  });

  it("reads an account revoked-before cutoff", async () => {
    const key = realtimeRedisKey("sub", "account-id");
    expect(await getRevocationCutoff(key)).toBeNull();
    expect(await setExpiringValue(key, "1723800000", 60_000)).toBe(true);
    expect(await getRevocationCutoff(key)).toBe(1_723_800_000);
  });

  it("reads revocation markers in one batch", async () => {
    const session = realtimeRedisKey("sid", "session-id");
    const account = realtimeRedisKey("sub", "account-id");
    await setExpiringValue(session, "1", 60_000);
    await setExpiringValue(account, "1723800000", 60_000);
    expect(await getValues([session, account, "missing"])).toEqual({
      available: true,
      values: ["1", "1723800000", null],
    });
  });

  it("fails closed when the shared production limiter has no Redis", async () => {
    await expect(checkDistributedRateLimit("rate-key", 5, 10_000)).resolves.toEqual({
      allowed: false,
      retryAfterMs: 10_000,
    });
  });
});
