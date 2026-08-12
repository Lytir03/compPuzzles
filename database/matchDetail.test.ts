import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Difficulty,
  DisconnectStatus,
  GameType,
  MatchResult,
  MatchStatus,
} from "@/database/generated/client/enums";

/**
 * `fetchMatchDetail` backs `/matches/[id]`, which exposes both players' ratings
 * before and after and both solve times. That's the SPEC §20 audit trail, and
 * it is exactly the data that must not leak to a stranger — so the access rule
 * (participants only, completed matches only) is the part worth pinning down.
 *
 * It also must never widen into reading the puzzle's solution, which would
 * break the "no solutions leaked" non-negotiable if the page were ever
 * reachable mid-match.
 */

const MATCH_ID = "match_1";
const ALICE = "user_alice";
const BOB = "user_bob";

let matchRow: Record<string, unknown> | null;
let lastFindArgs: Record<string, unknown> | undefined;

function participant(userId: string, username: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `participant_${userId}`,
    matchId: MATCH_ID,
    userId,
    startingRating: 1500,
    endingRating: 1516,
    result: MatchResult.WIN,
    completionTimeMs: 61_000,
    mistakes: 0,
    disconnectStatus: DisconnectStatus.CONNECTED,
    user: { username },
    ...overrides,
  };
}

function completedMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID,
    gameType: GameType.SUDOKU,
    difficulty: Difficulty.MEDIUM,
    puzzleId: "puzzle_1",
    status: MatchStatus.COMPLETED,
    startedAt: new Date("2026-08-11T10:00:00Z"),
    completedAt: new Date("2026-08-11T10:02:00Z"),
    winnerUserId: ALICE,
    participants: [
      participant(ALICE, "alice"),
      participant(BOB, "bob", {
        endingRating: 1484,
        result: MatchResult.LOSS,
        completionTimeMs: null,
        mistakes: 2,
        disconnectStatus: DisconnectStatus.DISCONNECTED,
      }),
    ],
    ...overrides,
  };
}

// `matchHistory.ts` is server-only by design; the guard package throws outside
// a real server component, so it's stubbed for the unit test.
vi.mock("server-only", () => ({}));

vi.mock("@/database/client", () => ({
  prisma: {
    match: {
      findUnique: async (args: Record<string, unknown>) => {
        lastFindArgs = args;
        return matchRow;
      },
    },
  },
}));

const { fetchMatchDetail } = await import("./matchHistory");

beforeEach(() => {
  matchRow = completedMatch();
  lastFindArgs = undefined;
});

describe("fetchMatchDetail", () => {
  it("returns both sides from the viewer's perspective", async () => {
    const detail = await fetchMatchDetail(MATCH_ID, ALICE);

    expect(detail).not.toBeNull();
    expect(detail!.you.username).toBe("alice");
    expect(detail!.opponent!.username).toBe("bob");
    expect(detail!.you.startingRating).toBe(1500);
    expect(detail!.you.endingRating).toBe(1516);
    expect(detail!.winnerUserId).toBe(ALICE);
  });

  it("flips 'you' and 'opponent' for the other participant", async () => {
    const detail = await fetchMatchDetail(MATCH_ID, BOB);

    expect(detail!.you.username).toBe("bob");
    expect(detail!.you.mistakes).toBe(2);
    expect(detail!.you.disconnected).toBe(true);
    expect(detail!.opponent!.username).toBe("alice");
    expect(detail!.opponent!.disconnected).toBe(false);
  });

  it("returns null for someone who wasn't in the match", async () => {
    expect(await fetchMatchDetail(MATCH_ID, "user_carol")).toBeNull();
  });

  it("returns null while the match is still in progress", async () => {
    matchRow = completedMatch({ status: MatchStatus.IN_PROGRESS });
    expect(await fetchMatchDetail(MATCH_ID, ALICE)).toBeNull();
  });

  it("returns null for a match that doesn't exist", async () => {
    matchRow = null;
    expect(await fetchMatchDetail("nope", ALICE)).toBeNull();
  });

  it("never selects the puzzle's solution", async () => {
    await fetchMatchDetail(MATCH_ID, ALICE);

    // Only the participant join is included — pulling in `puzzle` here would
    // put the answer key one careless `select` away from the response.
    expect(JSON.stringify(lastFindArgs)).not.toContain("puzzle");
  });
});
