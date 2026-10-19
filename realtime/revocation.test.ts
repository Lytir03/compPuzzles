import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRevoked: vi.fn(),
  getRevocationCutoff: vi.fn(),
  realtimeRedisKey: vi.fn((scope: string, value: string) => `${scope}:${value}`),
}));
vi.mock("./upstash", () => mocks);

const { realtimeIdentityIsActive } = await import("./revocation");
const identity = { authUserId: "auth-user", sessionId: "session", ticketIssuedAt: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isRevoked.mockResolvedValue(false);
  mocks.getRevocationCutoff.mockResolvedValue(null);
});

describe("realtimeIdentityIsActive", () => {
  it("hits both fail-closed shared markers on every invocation", async () => {
    await expect(realtimeIdentityIsActive(identity)).resolves.toBe(true);
    await expect(realtimeIdentityIsActive(identity)).resolves.toBe(true);
    expect(mocks.isRevoked).toHaveBeenCalledTimes(2);
    expect(mocks.getRevocationCutoff).toHaveBeenCalledTimes(2);
  });

  it("rejects session and subject cutoffs", async () => {
    mocks.isRevoked.mockResolvedValueOnce(true);
    await expect(realtimeIdentityIsActive(identity)).resolves.toBe(false);

    mocks.getRevocationCutoff.mockResolvedValueOnce(100);
    await expect(realtimeIdentityIsActive(identity)).resolves.toBe(false);
  });
});
