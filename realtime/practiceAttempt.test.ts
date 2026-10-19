import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock("@/database/client", () => ({ prisma: { puzzleAttempt: { updateMany: mocks.updateMany } } }));

const { claimActivePracticeAttempt } = await import("./practiceAttempt");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("claimActivePracticeAttempt", () => {
  it("binds the CAS to auth ownership and an ACTIVE competitor", async () => {
    const submittedAt = new Date("2026-08-17T12:00:00.000Z");
    await expect(claimActivePracticeAttempt("attempt", "auth-user", {
      submittedAt,
      durationMs: 1_000,
      completed: true,
      mistakes: 0,
    })).resolves.toBe(true);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "attempt",
        authUserId: "auth-user",
        submittedAt: null,
        account: { competitor: { status: "ACTIVE" } },
      },
      data: { submittedAt, durationMs: 1_000, completed: true, mistakes: 0 },
    });
  });

  it("fails closed when deletion/deactivation or another submit wins", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimActivePracticeAttempt("attempt", "auth-user", {
      submittedAt: new Date(),
      durationMs: 1_000,
      completed: false,
      mistakes: 1,
    })).resolves.toBe(false);
  });
});
