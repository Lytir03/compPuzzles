import { checkDistributedRateLimit, realtimeRedisKey } from "./upstash";

export type PracticeRateOperation = "start" | "submit";

/** Enforces independent network and account budgets for authenticated play. */
export async function checkPracticeRateLimit(
  operation: PracticeRateOperation,
  clientKey: string,
  authUserId: string | null,
): Promise<boolean> {
  const limit = operation === "start" ? 15 : 30;
  const subjects = [`practice:${operation}:ip:${clientKey}`];
  if (authUserId) subjects.push(`practice:${operation}:user:${authUserId}`);

  const decisions = await Promise.all(
    subjects.map((subject) =>
      checkDistributedRateLimit(
        realtimeRedisKey("rate", subject),
        limit,
        5 * 60 * 1_000,
      ),
    ),
  );
  return decisions.every((decision) => decision.allowed);
}
