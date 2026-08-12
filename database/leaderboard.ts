import "server-only";
import { prisma } from "@/database/client";
import type { GameType } from "@/database/generated/client/enums";

/**
 * One place that knows what "ranked standings" means, so the leaderboard page
 * and the dashboard preview can't drift into showing different orderings of
 * the same ladder.
 */

export interface StandingRow {
  id: string;
  userId: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
}

/** Only players with a completed match appear — a provisional 1500 isn't a standing. */
const rankedWhere = (gameType: GameType) => ({ gameType, gamesPlayed: { gt: 0 } });

/**
 * Rating alone leaves ties ordered nondeterministically across requests, which
 * makes a player's displayed rank flicker between reloads — hence the
 * secondary keys.
 */
const RANKED_ORDER = [
  { rating: "desc" as const },
  { gamesPlayed: "desc" as const },
  { userId: "asc" as const },
];

export async function fetchStandings(
  gameType: GameType,
  { take = 50, skip = 0 }: { take?: number; skip?: number } = {},
): Promise<StandingRow[]> {
  const rows = await prisma.playerGameRating.findMany({
    where: rankedWhere(gameType),
    orderBy: RANKED_ORDER,
    take,
    skip,
    include: { user: { select: { username: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    username: row.user.username,
    rating: row.rating,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
  }));
}

export async function countRankedPlayers(gameType: GameType): Promise<number> {
  return prisma.playerGameRating.count({ where: rankedWhere(gameType) });
}
