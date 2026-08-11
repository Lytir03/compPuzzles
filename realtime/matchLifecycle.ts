import { prisma } from "@/database/client";
import { DisconnectStatus, MatchResult, MatchStatus } from "@/database/generated/client/enums";
import { determineWinner, type ParticipantOutcome } from "@/matchmaking/determineWinner";
import type { Server } from "socket.io";
import { activeSockets } from "./state";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

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
 * Persists the match's outcome and notifies both clients. Rating is
 * deliberately untouched here — endingRating is just set equal to
 * startingRating. Real rating math is Phase 4 ("Ranked Sudoku"); Phase 3
 * only delivers working matchmaking + live play + a server-validated
 * winner.
 */
export async function finalizeMatch(
  io: AppServer,
  matchId: string,
  outcome: NonNullable<ReturnType<typeof determineWinner>>,
): Promise<void> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { participants: true },
  });
  if (match.status === MatchStatus.COMPLETED) return; // already finalized, avoid double-processing

  const winnerUserId = outcome.type === "winner" ? outcome.winnerUserId : null;

  function resultFor(userId: string): MatchResult {
    if (outcome.type === "draw") return MatchResult.DRAW;
    if (userId === winnerUserId) return MatchResult.WIN;
    // The loser in an abandonment outcome is, by definition, the one who
    // disconnected — distinct from a LOSS where they simply didn't finish first.
    return outcome.reason === "abandonment" ? MatchResult.ABANDONED : MatchResult.LOSS;
  }

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.COMPLETED, completedAt: new Date(), winnerUserId },
    }),
    ...match.participants.map((participant) =>
      prisma.matchParticipant.update({
        where: { id: participant.id },
        data: {
          endingRating: participant.startingRating,
          result: resultFor(participant.userId),
        },
      }),
    ),
  ]);

  for (const participant of match.participants) {
    const socket = activeSockets.get(participant.userId);
    if (!socket) continue;
    socket.emit("match:result", {
      matchId,
      outcome:
        outcome.type === "draw" ? "DRAW" : participant.userId === winnerUserId ? "WIN" : "LOSS",
      reason: outcome.type === "draw" ? "draw" : outcome.reason,
    });
    socket.leave(matchId);
  }
}
