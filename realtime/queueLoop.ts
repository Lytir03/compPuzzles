import { prisma } from "@/database/client";
import { Difficulty, GameType, MatchStatus } from "@/database/generated/client/enums";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import { findPairs, type QueueCandidate } from "@/matchmaking/matchmaker";
import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { activeSockets } from "./state";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

const SUPPORTED_GAME_TYPES = [GameType.SUDOKU, GameType.NONOGRAM, GameType.CROSSWORD];
const DIFFICULTIES = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];

let tickRunning = false;

/**
 * Runs one matchmaking pass. Guarded against overlapping with itself
 * (single process, no horizontal scaling — see realtime/state.ts) so the
 * delete-queue-entries + create-match sequence never races against another
 * tick, without needing DB-level row locking.
 */
export async function runMatchmakingTick(io: AppServer): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    for (const gameType of SUPPORTED_GAME_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        await matchQueue(io, gameType, difficulty);
      }
    }
  } finally {
    tickRunning = false;
  }
}

async function matchQueue(io: AppServer, gameType: GameType, difficulty: Difficulty) {
  const entries = await prisma.matchmakingQueueEntry.findMany({
    where: { gameType, difficulty },
  });
  if (entries.length < 2) return;

  const candidates: QueueCandidate[] = entries.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    rating: entry.rating,
    queuedAt: entry.queuedAt,
  }));

  const pairs = findPairs(candidates, new Date());

  for (const pair of pairs) {
    await createMatchFromPair(io, gameType, difficulty, pair.a.userId, pair.b.userId);
  }
}

async function createMatchFromPair(
  io: AppServer,
  gameType: GameType,
  difficulty: Difficulty,
  userIdA: string,
  userIdB: string,
) {
  const gameDefinition = getGameDefinition(gameType);
  const assignment = await gameDefinition.createMatch(difficulty, [userIdA, userIdB]);

  const [ratingA, ratingB] = await Promise.all([
    prisma.playerGameRating.findUniqueOrThrow({
      where: { userId_gameType: { userId: userIdA, gameType } },
    }),
    prisma.playerGameRating.findUniqueOrThrow({
      where: { userId_gameType: { userId: userIdB, gameType } },
    }),
  ]);

  const match = await prisma.$transaction(async (tx) => {
    // Both entries might already be gone if this pairing lost a race with
    // another one this same tick (e.g. a 3-way mutual-candidate overlap) —
    // deleteMany + count guards against creating a match for a stale pair.
    const deleted = await tx.matchmakingQueueEntry.deleteMany({
      where: { userId: { in: [userIdA, userIdB] }, gameType },
    });
    if (deleted.count !== 2) {
      throw new Error("stale-pair");
    }

    return tx.match.create({
      data: {
        gameType,
        difficulty,
        status: MatchStatus.IN_PROGRESS,
        startedAt: new Date(),
        puzzleId: assignment.puzzleId,
        participants: {
          create: [
            { userId: userIdA, startingRating: ratingA.rating },
            { userId: userIdB, startingRating: ratingB.rating },
          ],
        },
      },
    });
  }).catch((error) => {
    if (error instanceof Error && error.message === "stale-pair") return null;
    throw error;
  });

  if (!match) return;

  const startsAt = Date.now() + 3000;
  const [userA, userB] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userIdA } }),
    prisma.user.findUniqueOrThrow({ where: { id: userIdB } }),
  ]);

  for (const [userId, opponentUsername] of [
    [userIdA, userB.username],
    [userIdB, userA.username],
  ] as const) {
    const socket = activeSockets.get(userId);
    socket?.join(match.id);
    socket?.emit("match:found", {
      matchId: match.id,
      gameType,
      difficulty,
      payload: assignment.clientPayload,
      opponentUsername,
      startsAt,
    });
  }
}
