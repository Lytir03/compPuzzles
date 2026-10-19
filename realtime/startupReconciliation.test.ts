import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisconnectStatus, MatchStatus } from "@/database/generated/client/enums";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  buildParticipantOutcome: vi.fn(),
  finalizeMatch: vi.fn(),
}));

vi.mock("@/database/client", () => ({ prisma: { match: { findMany: mocks.findMany } } }));
vi.mock("./matchLifecycle", () => ({
  buildParticipantOutcome: mocks.buildParticipantOutcome,
  finalizeMatch: mocks.finalizeMatch,
}));

const { reconcileDecidedMatches } = await import("./startupReconciliation");
const io = {} as Parameters<typeof reconcileDecidedMatches>[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([
    { id: "completed-before-crash", participants: [{ competitorId: "a" }, { competitorId: "b" }] },
  ]);
  mocks.buildParticipantOutcome.mockImplementation(async (_matchId: string, competitorId: string) => ({
    userId: competitorId,
    completionTimeMs: competitorId === "a" ? 1_000 : null,
    mistakes: 0,
    disconnected: false,
  }));
  mocks.finalizeMatch.mockResolvedValue(undefined);
});

describe("reconcileDecidedMatches", () => {
  it("queries every live persisted completion and prior abandonment", async () => {
    await reconcileDecidedMatches(io);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        status: MatchStatus.IN_PROGRESS,
        OR: [
          { participants: { some: { completionTimeMs: { not: null } } } },
          { participants: { some: { disconnectStatus: DisconnectStatus.ABANDONED } } },
        ],
      },
      select: { id: true, participants: { select: { competitorId: true } } },
    });
  });

  it("re-drives the persisted completion through the existing finalization CAS", async () => {
    await expect(reconcileDecidedMatches(io)).resolves.toBe(1);
    expect(mocks.finalizeMatch).toHaveBeenCalledWith(io, "completed-before-crash", {
      type: "winner",
      winnerUserId: "a",
      reason: "completion",
    });
  });

  it("does not finalize a malformed or still-undecided row", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "wrong-cardinality", participants: [{ competitorId: "a" }] },
      { id: "undecided", participants: [{ competitorId: "a" }, { competitorId: "b" }] },
    ]);
    mocks.buildParticipantOutcome.mockImplementation(async (_matchId: string, competitorId: string) => ({
      userId: competitorId,
      completionTimeMs: null,
      mistakes: 0,
      disconnected: false,
    }));

    await expect(reconcileDecidedMatches(io)).resolves.toBe(0);
    expect(mocks.finalizeMatch).not.toHaveBeenCalled();
  });
});
