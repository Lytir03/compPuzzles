import { prisma } from "@/database/client";
import { DisconnectStatus, MatchStatus } from "@/database/generated/client/enums";

/**
 * Claims an unexpired disconnect grace period exactly once. The relational
 * match predicate prevents a reconnect from reviving a finalized match.
 */
export async function claimParticipantReconnect(
  participantId: string,
  now = new Date(),
): Promise<boolean> {
  const claimed = await prisma.matchParticipant.updateMany({
    where: {
      id: participantId,
      disconnectStatus: DisconnectStatus.DISCONNECTED,
      disconnectDeadlineAt: { gt: now },
      match: { status: MatchStatus.IN_PROGRESS },
    },
    data: {
      disconnectStatus: DisconnectStatus.RECONNECTED,
      disconnectDeadlineAt: null,
    },
  });
  return claimed.count === 1;
}
