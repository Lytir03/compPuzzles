import { prisma } from "@/database/client";
import { DisconnectStatus, MatchStatus } from "@/database/generated/client/enums";
import { determineWinner } from "@/matchmaking/determineWinner";
import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { buildParticipantOutcome, finalizeMatch } from "./matchLifecycle";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Closes the crash window after a completion/abandonment persisted but before
 * rating finalization. `finalizeMatch` owns the transactional CAS, so this is
 * safe to rerun on every startup.
 */
export async function reconcileDecidedMatches(io: AppServer): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.IN_PROGRESS,
      OR: [
        { participants: { some: { completionTimeMs: { not: null } } } },
        { participants: { some: { disconnectStatus: DisconnectStatus.ABANDONED } } },
      ],
    },
    select: { id: true, participants: { select: { competitorId: true } } },
  });

  let finalized = 0;
  for (const match of matches) {
    if (match.participants.length !== 2) continue;
    const [a, b] = await Promise.all([
      buildParticipantOutcome(match.id, match.participants[0].competitorId),
      buildParticipantOutcome(match.id, match.participants[1].competitorId),
    ]);
    const outcome = determineWinner([a, b]);
    if (!outcome) continue;
    await finalizeMatch(io, match.id, outcome);
    finalized++;
  }
  return finalized;
}
