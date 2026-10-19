import { prisma } from "@/database/client";
import { MatchResult, MatchStatus } from "@/database/generated/client/enums";
import type { MatchEndReason, MatchResultPayload } from "./events";

function publicOutcome(result: MatchResult): MatchResultPayload["outcome"] {
  if (result === MatchResult.WIN) return "WIN";
  if (result === MatchResult.DRAW) return "DRAW";
  return "LOSS";
}

function endReason(mine: MatchResult, theirs: MatchResult): MatchEndReason {
  if (mine === MatchResult.DRAW && theirs === MatchResult.DRAW) return "draw";
  if (mine === MatchResult.ABANDONED || theirs === MatchResult.ABANDONED) return "abandonment";
  return "completion";
}

/**
 * Rebuilds a completed result through a membership-constrained query. The
 * selected shape intentionally contains no competitor/auth identifiers.
 */
export async function getMatchResultForCompetitor(
  matchId: string,
  competitorId: string,
): Promise<MatchResultPayload | null> {
  const member = await prisma.matchParticipant.findUnique({
    where: { matchId_competitorId: { matchId, competitorId } },
    select: {
      startingRating: true,
      endingRating: true,
      result: true,
      completionTimeMs: true,
      match: {
        select: {
          id: true,
          status: true,
          participants: {
            where: { competitorId: { not: competitorId } },
            take: 1,
            select: {
              result: true,
              completionTimeMs: true,
              competitor: {
                select: { profile: { select: { username: true } } },
              },
            },
          },
        },
      },
    },
  });

  const opponent = member?.match.participants[0];
  if (
    !member
    || member.match.status !== MatchStatus.COMPLETED
    || member.endingRating === null
    || member.result === null
    || !opponent
    || opponent.result === null
  ) return null;

  return {
    matchId: member.match.id,
    outcome: publicOutcome(member.result),
    reason: endReason(member.result, opponent.result),
    ratingBefore: Math.round(member.startingRating),
    ratingAfter: Math.round(member.endingRating),
    completionTimeMs: member.completionTimeMs,
    opponentCompletionTimeMs: opponent.completionTimeMs,
    opponentUsername: opponent.competitor.profile?.username ?? "Deleted player",
  };
}
