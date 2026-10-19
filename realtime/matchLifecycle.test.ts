import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameType, MatchResult, MatchStatus } from "@/database/generated/client/enums";

/**
 * finalizeMatch is the one place a match awards rating, and CLAUDE.md makes
 * two hard promises about it: rating writes are atomic with match-result
 * writes, and a match never awards rating twice. Both were previously
 * untested. These tests drive it against an in-memory fake of the Prisma
 * surface it uses — enough to assert the transaction boundary, the
 * compare-and-set that closes the double-finalize race, and the rollback
 * behaviour, without needing a live Postgres.
 */

const MATCH_ID = "match_1";
const ALICE = "user_alice";
const BOB = "user_bob";

interface FakeState {
  matchStatus: MatchStatus;
  ratingUpdates: { competitorId: string; data: Record<string, unknown> }[];
  ratingChangeCreates: { competitorId: string; matchId: string }[];
  participantUpdates: { id: string; data: Record<string, unknown> }[];
  transactionCount: number;
  completedTransactions: number;
}

let state: FakeState;

function participantRow(competitorId: string, completionTimeMs: number | null, username: string) {
  return {
    id: `participant_${competitorId}`,
    competitorId,
    matchId: MATCH_ID,
    startingRating: 1500,
    completionTimeMs,
    mistakes: 0,
    competitor: { profile: { username } },
  };
}

let participants = [
  participantRow(ALICE, 60_000, "alice"),
  participantRow(BOB, null, "bob"),
];

/**
 * Writes go into a per-transaction buffer and are applied to shared state only
 * on commit, so a rolled-back transaction can't clobber a committed one. The
 * `match.updateMany` guard reads committed state, matching Postgres row
 * locking: a second finalization can't observe IN_PROGRESS once the first has
 * committed COMPLETED.
 */
interface TxBuffer {
  claimed: boolean;
  ratingUpdates: FakeState["ratingUpdates"];
  ratingChangeCreates: FakeState["ratingChangeCreates"];
  participantUpdates: FakeState["participantUpdates"];
}

function makeTx(buffer: TxBuffer) {
  return {
    playerGameRating: {
      findUniqueOrThrow: async ({ where }: { where: { competitorId_gameType: { competitorId: string } } }) => ({
        competitorId: where.competitorId_gameType.competitorId,
        rating: 1500,
        ratingDeviation: 200,
        volatility: 0.06,
        peakRating: 1500,
      }),
      update: async ({
        where,
        data,
      }: {
        where: { competitorId_gameType: { competitorId: string } };
        data: Record<string, unknown>;
      }) => {
        buffer.ratingUpdates.push({ competitorId: where.competitorId_gameType.competitorId, data });
      },
    },
    match: {
      updateMany: async ({ where }: { where: { status: MatchStatus } }) => {
        // Mirrors Postgres: the conditional update only matches while the
        // committed row is still IN_PROGRESS, so exactly one racer claims it.
        if (state.matchStatus !== where.status) return { count: 0 };
        buffer.claimed = true;
        return { count: 1 };
      },
    },
    ratingChange: {
      create: async ({ data }: { data: { competitorId: string; matchId: string } }) => {
        const duplicate = [...state.ratingChangeCreates, ...buffer.ratingChangeCreates].some(
          (c) => c.competitorId === data.competitorId && c.matchId === data.matchId,
        );
        // Stands in for @@unique([userId, matchId]) — the DB-level backstop.
        if (duplicate) throw new Error("Unique constraint failed on RatingChange");
        buffer.ratingChangeCreates.push({ competitorId: data.competitorId, matchId: data.matchId });
      },
    },
    matchParticipant: {
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        buffer.participantUpdates.push({ id: where.id, data });
      },
    },
  };
}

/** Serializes transactions, the way row-level locking on the match does. */
let txChain: Promise<unknown> = Promise.resolve();

vi.mock("@/database/client", () => ({
  prisma: {
    match: {
      findUniqueOrThrow: async () => ({
        id: MATCH_ID,
        gameType: GameType.SUDOKU,
        status: state.matchStatus,
        participants,
      }),
    },
    matchParticipant: {
      findUniqueOrThrow: async ({ where }: { where: { matchId_competitorId: { competitorId: string } } }) => {
        const found = participants.find(
          (p) => p.competitorId === where.matchId_competitorId.competitorId,
        );
        if (!found) throw new Error("participant not found");
        return { ...found, disconnectStatus: "CONNECTED" };
      },
    },
    $transaction: (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      state.transactionCount++;
      const run = txChain.then(async () => {
        const buffer: TxBuffer = {
          claimed: false,
          ratingUpdates: [],
          ratingChangeCreates: [],
          participantUpdates: [],
        };
        // A throw anywhere inside discards the buffer entirely — nothing
        // partial reaches shared state, which is the atomicity guarantee
        // CLAUDE.md requires of rating writes.
        const result = await fn(makeTx(buffer));
        if (buffer.claimed) state.matchStatus = MatchStatus.COMPLETED;
        state.ratingUpdates.push(...buffer.ratingUpdates);
        state.ratingChangeCreates.push(...buffer.ratingChangeCreates);
        state.participantUpdates.push(...buffer.participantUpdates);
        state.completedTransactions++;
        return result;
      });
      // Keep the chain alive regardless of this transaction's fate.
      txChain = run.catch(() => {});
      return run;
    },
  },
}));

const emitted: { userId: string; event: string; payload: unknown }[] = [];

vi.mock("./state", () => ({
  activeSockets: {
    get: (userId: string) => ({
      emit: (event: string, payload: unknown) => emitted.push({ userId, event, payload }),
      leave: () => {},
    }),
  },
  abandonmentTimers: new Map(),
  abandonmentTimerKey: (matchId: string, userId: string) => `${matchId}:${userId}`,
}));

const { finalizeMatch } = await import("./matchLifecycle");

const io = {} as Parameters<typeof finalizeMatch>[0];
const aliceWins = { type: "winner", winnerUserId: ALICE, reason: "completion" } as const;

beforeEach(() => {
  state = {
    matchStatus: MatchStatus.IN_PROGRESS,
    ratingUpdates: [],
    ratingChangeCreates: [],
    participantUpdates: [],
    transactionCount: 0,
    completedTransactions: 0,
  };
  participants = [participantRow(ALICE, 60_000, "alice"), participantRow(BOB, null, "bob")];
  emitted.length = 0;
  txChain = Promise.resolve();
});

describe("finalizeMatch", () => {
  it("awards rating to both players and completes the match", async () => {
    await finalizeMatch(io, MATCH_ID, aliceWins);

    expect(state.matchStatus).toBe(MatchStatus.COMPLETED);
    expect(state.ratingChangeCreates).toHaveLength(2);
    expect(state.ratingUpdates.map((u) => u.competitorId).sort()).toEqual([ALICE, BOB]);

    const results = state.participantUpdates.map((u) => u.data.result);
    expect(results).toContain(MatchResult.WIN);
    expect(results).toContain(MatchResult.LOSS);
  });

  it("does all rating and result writes inside a single transaction", async () => {
    await finalizeMatch(io, MATCH_ID, aliceWins);
    expect(state.transactionCount).toBe(1);
    expect(state.completedTransactions).toBe(1);
  });

  it("is idempotent — a second call awards nothing more", async () => {
    await finalizeMatch(io, MATCH_ID, aliceWins);
    await finalizeMatch(io, MATCH_ID, aliceWins);

    expect(state.ratingChangeCreates).toHaveLength(2);
    expect(state.ratingUpdates).toHaveLength(2);
    // The second call short-circuits before opening a transaction at all.
    expect(state.transactionCount).toBe(1);
  });

  it("awards rating once when two finalizations race past the status read", async () => {
    // Both callers read the match while it is still IN_PROGRESS — the exact
    // race between both players submitting and the abandonment timer firing.
    await Promise.all([
      finalizeMatch(io, MATCH_ID, aliceWins),
      finalizeMatch(io, MATCH_ID, aliceWins),
    ]);

    expect(state.transactionCount).toBe(2);
    expect(state.completedTransactions).toBe(1);
    expect(state.ratingChangeCreates).toHaveLength(2);
    expect(state.ratingUpdates).toHaveLength(2);
  });

  it("leaves no partial writes behind when a finalization loses the race", async () => {
    await Promise.all([
      finalizeMatch(io, MATCH_ID, aliceWins),
      finalizeMatch(io, MATCH_ID, aliceWins),
    ]);

    // Exactly one transaction's worth of writes total — the loser rolled back
    // before touching ratings or participant results.
    expect(state.participantUpdates).toHaveLength(2);
    expect(state.ratingUpdates).toHaveLength(2);
    expect(state.matchStatus).toBe(MatchStatus.COMPLETED);
  });

  it("notifies both players with mirrored outcomes and solve times", async () => {
    await finalizeMatch(io, MATCH_ID, aliceWins);

    const results = emitted.filter((e) => e.event === "match:result");
    expect(results).toHaveLength(2);

    const toAlice = results.find((r) => r.userId === ALICE)!.payload as Record<string, unknown>;
    const toBob = results.find((r) => r.userId === BOB)!.payload as Record<string, unknown>;

    expect(toAlice.outcome).toBe("WIN");
    expect(toBob.outcome).toBe("LOSS");
    expect(toAlice.completionTimeMs).toBe(60_000);
    expect(toAlice.opponentCompletionTimeMs).toBeNull();
    expect(toAlice.opponentUsername).toBe("bob");
    expect(toBob.opponentUsername).toBe("alice");
  });

  it("emits only one result per player when finalizations race", async () => {
    await Promise.all([
      finalizeMatch(io, MATCH_ID, aliceWins),
      finalizeMatch(io, MATCH_ID, aliceWins),
    ]);
    // A second emit would replay the rating-change animation on both clients.
    expect(emitted.filter((e) => e.event === "match:result")).toHaveLength(2);
  });

  it("records a draw as a draw for both players", async () => {
    await finalizeMatch(io, MATCH_ID, { type: "draw" });

    const results = state.participantUpdates.map((u) => u.data.result);
    expect(results).toEqual([MatchResult.DRAW, MatchResult.DRAW]);
    expect(emitted.filter((e) => e.event === "match:result").map((e) => (e.payload as { outcome: string }).outcome))
      .toEqual(["DRAW", "DRAW"]);
  });

  it("marks the disconnecting player ABANDONED rather than a plain LOSS", async () => {
    await finalizeMatch(io, MATCH_ID, {
      type: "winner",
      winnerUserId: ALICE,
      reason: "abandonment",
    });

    const bobUpdate = state.participantUpdates.find((u) => u.id === `participant_${BOB}`)!;
    expect(bobUpdate.data.result).toBe(MatchResult.ABANDONED);
  });

  it("refuses to finalize a match without exactly two participants", async () => {
    participants = [participantRow(ALICE, 60_000, "alice")];
    await expect(finalizeMatch(io, MATCH_ID, aliceWins)).rejects.toThrow(/expected 2/i);
    expect(state.transactionCount).toBe(0);
  });
});
