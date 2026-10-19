import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRevoked: vi.fn(),
  realtimeRedisKey: vi.fn((_scope: string, value: string) => `hashed:${value}`),
}));
vi.mock("./upstash", () => mocks);

const { practiceSessionIsActive } = await import("./practiceSession");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isRevoked.mockResolvedValue(false);
});

describe("practiceSessionIsActive", () => {
  it("checks the shared revocation marker on every authenticated call", async () => {
    await expect(practiceSessionIsActive("auth-user", "session-1")).resolves.toBe(true);
    expect(mocks.isRevoked).toHaveBeenCalledWith("hashed:session-1");

    mocks.isRevoked.mockResolvedValueOnce(true);
    await expect(practiceSessionIsActive("auth-user", "session-1")).resolves.toBe(false);
    expect(mocks.isRevoked).toHaveBeenCalledTimes(2);
  });

  it("fails closed for a missing/malformed authenticated sid but permits guests", async () => {
    await expect(practiceSessionIsActive("auth-user", null)).resolves.toBe(false);
    await expect(practiceSessionIsActive("auth-user", "bad session")).resolves.toBe(false);
    await expect(practiceSessionIsActive(null, null)).resolves.toBe(true);
  });
});
