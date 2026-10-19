import { beforeEach, describe, expect, it, vi } from "vitest";

const checkDistributedRateLimit = vi.fn();
const realtimeRedisKey = vi.fn((kind: string, raw: string) => `${kind}:${raw}`);

vi.mock("./upstash", () => ({ checkDistributedRateLimit, realtimeRedisKey }));

const { checkPracticeRateLimit } = await import("./practiceRate");

beforeEach(() => {
  vi.clearAllMocks();
  checkDistributedRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe("checkPracticeRateLimit", () => {
  it("charges both the IP and account budgets for authenticated practice", async () => {
    await expect(checkPracticeRateLimit("start", "ip-hash", "auth-user")).resolves.toBe(true);
    expect(realtimeRedisKey).toHaveBeenNthCalledWith(1, "rate", "practice:start:ip:ip-hash");
    expect(realtimeRedisKey).toHaveBeenNthCalledWith(2, "rate", "practice:start:user:auth-user");
    expect(checkDistributedRateLimit).toHaveBeenCalledTimes(2);
  });

  it("fails when either independent budget is denied", async () => {
    checkDistributedRateLimit
      .mockResolvedValueOnce({ allowed: true, retryAfterMs: 0 })
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 1_000 });

    await expect(checkPracticeRateLimit("submit", "ip-hash", "auth-user")).resolves.toBe(false);
  });

  it("uses only the IP budget for a guest", async () => {
    await expect(checkPracticeRateLimit("submit", "ip-hash", null)).resolves.toBe(true);
    expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
  });
});
