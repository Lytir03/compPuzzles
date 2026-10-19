import { prisma } from "@/database/client";
import { CompetitorStatus, MatchStatus } from "@/database/generated/client/enums";

export type CompletionRecordResult = "pre-start" | "recorded" | "duplicate";

/** Returns null until the server-authored countdown has actually elapsed. */
export function elapsedSinceStart(startedAt: Date | null, nowMs = Date.now()): number | null {
  if (!startedAt) return null;
  const elapsed = nowMs - startedAt.getTime();
  return elapsed < 0 ? null : elapsed;
}

/**
 * Compare-and-set the first correct completion. Concurrent/replayed correct
 * submissions can never replace the solve time used for the winner decision.
 */
export async function recordFirstCompletion(
  participantId: string,
  competitorId: string,
  startedAt: Date | null,
  nowMs = Date.now(),
): Promise<CompletionRecordResult> {
  const completionTimeMs = elapsedSinceStart(startedAt, nowMs);
  if (completionTimeMs === null) return "pre-start";

  const claimed = await prisma.matchParticipant.updateMany({
    where: {
      id: participantId,
      competitorId,
      completionTimeMs: null,
      competitor: { status: CompetitorStatus.ACTIVE },
      match: { status: MatchStatus.IN_PROGRESS },
    },
    data: { completionTimeMs },
  });
  return claimed.count === 1 ? "recorded" : "duplicate";
}
