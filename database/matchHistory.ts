import "server-only";
import { prisma } from "@/database/client";
import {
  Difficulty,
  GameType,
  MatchResult,
  MatchStatus,
} from "@/database/generated/client/enums";

/**
 * One place that knows how to read a player's completed matches, so the
 * dashboard, profile, and match-history pages agree on shape and ordering
 * rather than each hand-rolling a slightly different include.
 */

export interface MatchHistoryRow {
  id: string;
  matchId: string;
  gameType: GameType;
  difficulty: Difficulty;
  result: MatchResult | null;
  opponentUsername: string | null;
  ratingDelta: number | null;
  ratingAfter: number | null;
  completionTimeMs: number | null;
  opponentCompletionTimeMs: number | null;
  mistakes: number;
  completedAt: Date | null;
}

export interface MatchHistoryQuery {
  take?: number;
  skip?: number;
  gameType?: GameType;
}

export async function fetchMatchHistory(
  userId: string,
  { take = 10, skip = 0, gameType }: MatchHistoryQuery = {},
): Promise<MatchHistoryRow[]> {
  const rows = await prisma.matchParticipant.findMany({
    where: {
      userId,
      match: { status: MatchStatus.COMPLETED, ...(gameType ? { gameType } : {}) },
    },
    orderBy: { match: { completedAt: "desc" } },
    take,
    skip,
    include: {
      match: {
        include: { participants: { include: { user: { select: { username: true } } } } },
      },
    },
  });

  return rows.map((participant) => {
    const opponent = participant.match.participants.find((p) => p.userId !== userId);
    return {
      id: participant.id,
      matchId: participant.matchId,
      gameType: participant.match.gameType,
      difficulty: participant.match.difficulty,
      result: participant.result,
      opponentUsername: opponent?.user.username ?? null,
      ratingDelta:
        participant.endingRating !== null
          ? Math.round(participant.endingRating - participant.startingRating)
          : null,
      ratingAfter:
        participant.endingRating !== null ? Math.round(participant.endingRating) : null,
      completionTimeMs: participant.completionTimeMs,
      opponentCompletionTimeMs: opponent?.completionTimeMs ?? null,
      mistakes: participant.mistakes,
      completedAt: participant.match.completedAt,
    };
  });
}

export async function countMatches(userId: string, gameType?: GameType): Promise<number> {
  return prisma.matchParticipant.count({
    where: {
      userId,
      match: { status: MatchStatus.COMPLETED, ...(gameType ? { gameType } : {}) },
    },
  });
}

/**
 * Per-game solve times for a player, used for the profile's average/best
 * figures. Aggregated in JS (see lib/playerStats.ts) rather than in SQL
 * because the numbers are small at MVP scale and the arithmetic is then
 * unit-testable without a database.
 */
export const COMPLETION_TIME_SAMPLE = 200;

export async function fetchCompletionTimes(
  userId: string,
  gameType: GameType,
): Promise<(number | null)[]> {
  const rows = await prisma.matchParticipant.findMany({
    where: { userId, match: { status: MatchStatus.COMPLETED, gameType } },
    orderBy: { match: { completedAt: "desc" } },
    // Bounded: this runs three times on every profile render, and unbounded it
    // grows with a player's entire career. The most recent N is also the more
    // honest "average solve" — a player's first-week times shouldn't weigh on
    // their current form forever.
    take: COMPLETION_TIME_SAMPLE,
    select: { completionTimeMs: true },
  });
  return rows.map((row) => row.completionTimeMs);
}

export interface MatchDetailSide {
  userId: string;
  username: string;
  result: MatchResult | null;
  startingRating: number;
  endingRating: number | null;
  completionTimeMs: number | null;
  mistakes: number;
  disconnected: boolean;
}

export interface MatchDetail {
  id: string;
  gameType: GameType;
  difficulty: Difficulty;
  puzzleId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  winnerUserId: string | null;
  you: MatchDetailSide;
  opponent: MatchDetailSide | null;
}

/**
 * A single match as SPEC §20 wants it auditable: both sides' ratings before and
 * after, both solve times, and the puzzle the result was computed against.
 *
 * Returns null when the match doesn't exist, isn't finished, or the viewer
 * wasn't in it — a completed match's stored data is the only record of a
 * rating change, so it's readable strictly by its own participants.
 */
export async function fetchMatchDetail(
  matchId: string,
  viewerId: string,
): Promise<MatchDetail | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { participants: { include: { user: { select: { username: true } } } } },
  });
  if (!match || match.status !== MatchStatus.COMPLETED) return null;

  const you = match.participants.find((p) => p.userId === viewerId);
  if (!you) return null;
  const opponent = match.participants.find((p) => p.userId !== viewerId);

  const toSide = (p: typeof you): MatchDetailSide => ({
    userId: p.userId,
    username: p.user.username,
    result: p.result,
    startingRating: p.startingRating,
    endingRating: p.endingRating,
    completionTimeMs: p.completionTimeMs,
    mistakes: p.mistakes,
    disconnected: p.disconnectStatus !== "CONNECTED",
  });

  return {
    id: match.id,
    gameType: match.gameType,
    difficulty: match.difficulty,
    puzzleId: match.puzzleId,
    startedAt: match.startedAt,
    completedAt: match.completedAt,
    winnerUserId: match.winnerUserId,
    you: toSide(you),
    opponent: opponent ? toSide(opponent) : null,
  };
}
