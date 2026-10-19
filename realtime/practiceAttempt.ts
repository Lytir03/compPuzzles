import { prisma } from "@/database/client";
import { CompetitorStatus } from "@/database/generated/client/enums";

interface PracticeAttemptResult {
  submittedAt: Date;
  durationMs: number;
  completed: boolean;
  mistakes: number;
}

/** Claims an authenticated attempt only while its competitor remains ACTIVE. */
export async function claimActivePracticeAttempt(
  attemptId: string,
  authUserId: string,
  result: PracticeAttemptResult,
): Promise<boolean> {
  const claimed = await prisma.puzzleAttempt.updateMany({
    where: {
      id: attemptId,
      authUserId,
      submittedAt: null,
      account: { competitor: { status: CompetitorStatus.ACTIVE } },
    },
    data: result,
  });
  return claimed.count === 1;
}
