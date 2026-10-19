import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchResult, MatchStatus } from "@/database/generated/client/enums";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/database/client", () => ({
  prisma: { matchParticipant: { findUnique: mocks.findUnique } },
}));

const { getMatchResultForCompetitor } = await import("./resultSync");

const MATCH_ID = "7e6a988b-75f3-4c87-a78d-cf3f940b22bc";
const COMPETITOR_ID = "7c6a988b-75f3-4c87-a78d-cf3f940b22bc";

function completedRow(
  mine: MatchResult = MatchResult.WIN,
  theirs: MatchResult = MatchResult.LOSS,
) {
  return {
    startingRating: 400.4,
    endingRating: 421.6,
    result: mine,
    completionTimeMs: 12_345,
    match: {
      id: MATCH_ID,
      status: MatchStatus.COMPLETED,
      participants: [{
        result: theirs,
        completionTimeMs: null,
        competitor: { profile: { username: "opponent" } },
      }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(completedRow());
});

describe("getMatchResultForCompetitor", () => {
  it("binds the lookup to authenticated membership and selects no competitor id", async () => {
    const result = await getMatchResultForCompetitor(MATCH_ID, COMPETITOR_ID);
    const query = mocks.findUnique.mock.calls[0][0];

    expect(query.where).toEqual({
      matchId_competitorId: { matchId: MATCH_ID, competitorId: COMPETITOR_ID },
    });
    expect(JSON.stringify(query.select)).not.toContain("competitorId\":true");
    expect(result).toEqual({
      matchId: MATCH_ID,
      outcome: "WIN",
      reason: "completion",
      ratingBefore: 400,
      ratingAfter: 422,
      completionTimeMs: 12_345,
      opponentCompletionTimeMs: null,
      opponentUsername: "opponent",
    });
    expect(JSON.stringify(result)).not.toContain(COMPETITOR_ID);
  });

  it("does not reveal a missing, foreign, in-progress or partially purged result", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    await expect(getMatchResultForCompetitor(MATCH_ID, COMPETITOR_ID)).resolves.toBeNull();

    mocks.findUnique.mockResolvedValueOnce({
      ...completedRow(),
      match: { ...completedRow().match, status: MatchStatus.IN_PROGRESS },
    });
    await expect(getMatchResultForCompetitor(MATCH_ID, COMPETITOR_ID)).resolves.toBeNull();

    mocks.findUnique.mockResolvedValueOnce({ ...completedRow(), endingRating: null });
    await expect(getMatchResultForCompetitor(MATCH_ID, COMPETITOR_ID)).resolves.toBeNull();
  });

  it("reconstructs abandonment and draw reasons without exposing the winner id", async () => {
    mocks.findUnique.mockResolvedValueOnce(completedRow(MatchResult.WIN, MatchResult.ABANDONED));
    await expect(getMatchResultForCompetitor(MATCH_ID, COMPETITOR_ID)).resolves.toMatchObject({
      outcome: "WIN",
      reason: "abandonment",
    });

    mocks.findUnique.mockResolvedValueOnce(completedRow(MatchResult.DRAW, MatchResult.DRAW));
    await expect(getMatchResultForCompetitor(MATCH_ID, COMPETITOR_ID)).resolves.toMatchObject({
      outcome: "DRAW",
      reason: "draw",
    });
  });
});
