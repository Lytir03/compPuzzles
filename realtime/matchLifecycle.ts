import { prisma } from "@/database/client";
import { DisconnectStatus, MatchResult, MatchStatus } from "@/database/generated/client/enums";
import { determineWinner, type ParticipantOutcome } from "@/matchmaking/determineWinner";
import { updateRatingsForMatch, type MatchOutcomeForRating } from "@/rating/glicko2";
import type { Server } from "socket.io";
import { activeSockets } from "./state";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Sentinel used to roll back a finalization that lost the compare-and-set race. */
class AlreadyFinalizedError extends Error {
  constructor(matchId: string) {
    super(`Match ${matchId} was already finalized`);
    this.name = "AlreadyFinalizedError";
  }
}

export async function buildParticipantOutcome(
  matchId: string,
  userId: string,
): Promise<ParticipantOutcome> {
  const participant = await prisma.matchParticipant.findUniqueOrThrow({
    where: { matchId_userId: { matchId, userId } },
  });
  return {
    userId,
    completionTimeMs: participant.completionTimeMs,
    mistakes: participant.mistakes,
    disconnected: participant.disconnectStatus === DisconnectStatus.ABANDONED,
  };
}

/**
 * Persists the match's outcome — result, rating change, and match record —
 * atomically in one transaction (CLAUDE.md non-negotiable: rating writes
 * must be atomic with match-result writes, and a match must never award
 * rating twice; the @@unique([userId, matchId]) constraint on RatingChange
 * is the hard backstop for the latter even if this function somehow ran
 * twice concurrently). Then notifies both clients.
 */
export async function finalizeMatch(
  io: AppServer,
  matchId: string,
  outcome: NonNullable<ReturnType<typeof determineWinner>>,
): Promise<void> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { participants: { include: { user: { select: { username: true } } } } },
  });
  if (match.status === MatchStatus.COMPLETED) return; // already finalized, avoid double-processing
  if (match.participants.length !== 2) {
    throw new Error(`Match ${matchId} has ${match.participants.length} participants, expected 2`);
  }

  const winnerUserId = outcome.type === "winner" ? outcome.winnerUserId : null;

  function resultFor(userId: string): MatchResult {
    if (outcome.type === "draw") return MatchResult.DRAW;
    if (userId === winnerUserId) return MatchResult.WIN;
    // The loser in an abandonment outcome is, by definition, the one who
    // disconnected — distinct from a LOSS where they simply didn't finish first.
    return outcome.reason === "abandonment" ? MatchResult.ABANDONED : MatchResult.LOSS;
  }

  function ratingOutcomeFor(userId: string): MatchOutcomeForRating {
    if (outcome.type === "draw") return "DRAW";
    return userId === winnerUserId ? "WIN" : "LOSS";
  }

  const [participantA, participantB] = match.participants;

  const ratingChanges = await prisma.$transaction(async (tx) => {
    const [ratingA, ratingB] = await Promise.all([
      tx.playerGameRating.findUniqueOrThrow({
        where: { userId_gameType: { userId: participantA.userId, gameType: match.gameType } },
      }),
      tx.playerGameRating.findUniqueOrThrow({
        where: { userId_gameType: { userId: participantB.userId, gameType: match.gameType } },
      }),
    ]);

    const { a: newA, b: newB } = updateRatingsForMatch(ratingA, ratingB, ratingOutcomeFor(participantA.userId));

    // Compare-and-set on status, inside the transaction. The early return
    // above reads the match *before* the transaction opens, so two concurrent
    // finalizations (both players submitting at once, or a submit racing the
    // disconnect grace timer) can both pass it. Only one can flip a row that
    // is still IN_PROGRESS; the loser rolls back having written nothing.
    const claimed = await tx.match.updateMany({
      where: { id: matchId, status: MatchStatus.IN_PROGRESS },
      data: { status: MatchStatus.COMPLETED, completedAt: new Date(), winnerUserId },
    });
    if (claimed.count === 0) {
      throw new AlreadyFinalizedError(matchId);
    }

    const changes = new Map<string, { before: number; after: number; delta: number }>();

    for (const [participant, before, after] of [
      [participantA, ratingA, newA],
      [participantB, ratingB, newB],
    ] as const) {
      const result = resultFor(participant.userId);

      await tx.playerGameRating.update({
        where: { userId_gameType: { userId: participant.userId, gameType: match.gameType } },
        data: {
          rating: after.rating,
          ratingDeviation: after.ratingDeviation,
          volatility: after.volatility,
          peakRating: Math.max(before.peakRating, after.rating),
          gamesPlayed: { increment: 1 },
          wins: { increment: result === MatchResult.WIN ? 1 : 0 },
          losses: { increment: result === MatchResult.LOSS || result === MatchResult.ABANDONED ? 1 : 0 },
          draws: { increment: result === MatchResult.DRAW ? 1 : 0 },
        },
      });

      await tx.ratingChange.create({
        data: {
          userId: participant.userId,
          matchId,
          gameType: match.gameType,
          ratingBefore: before.rating,
          ratingAfter: after.rating,
          delta: after.rating - before.rating,
          rdBefore: before.ratingDeviation,
          rdAfter: after.ratingDeviation,
        },
      });

      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { endingRating: after.rating, result },
      });

      changes.set(participant.userId, {
        before: before.rating,
        after: after.rating,
        delta: after.rating - before.rating,
      });
    }

    return changes;
  }).catch((error) => {
    if (error instanceof AlreadyFinalizedError) return null;
    throw error;
  });

  // Another call finalized this match first and has already notified both
  // clients — emitting a second result would double-animate the rating change.
  if (!ratingChanges) return;

  for (const participant of match.participants) {
    const socket = activeSockets.get(participant.userId);
    if (!socket) continue;
    const change = ratingChanges.get(participant.userId)!;
    const opponent = match.participants.find((p) => p.userId !== participant.userId)!;
    socket.emit("match:result", {
      matchId,
      outcome:
        outcome.type === "draw" ? "DRAW" : participant.userId === winnerUserId ? "WIN" : "LOSS",
      reason: outcome.type === "draw" ? "draw" : outcome.reason,
      ratingBefore: Math.round(change.before),
      ratingAfter: Math.round(change.after),
      completionTimeMs: participant.completionTimeMs,
      opponentCompletionTimeMs: opponent.completionTimeMs,
      opponentUsername: opponent.user.username,
    });
    socket.leave(matchId);
  }
}
