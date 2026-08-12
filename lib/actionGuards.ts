import { Difficulty } from "@/database/generated/client/enums";
import { actionRateLimiter } from "./rateLimit";

/**
 * Shared input guards for server actions.
 *
 * Server actions are a public HTTP endpoint with a nice-looking call site —
 * anyone can invoke one with arbitrary arguments, so their parameters get the
 * same treatment as socket payloads (realtime/validation.ts) rather than being
 * trusted because a typed component happened to call them.
 */

const DIFFICULTIES = new Set<string>([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]);

const MAX_ID_LENGTH = 64;

export function assertDifficulty(value: unknown): Difficulty {
  if (typeof value !== "string" || !DIFFICULTIES.has(value)) {
    throw new Error("Invalid difficulty");
  }
  return value as Difficulty;
}

export function assertPuzzleId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID_LENGTH) {
    throw new Error("Invalid puzzle id");
  }
  return value;
}

export function assertDurationMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Invalid duration");
  }
  return Math.round(value);
}

/** Throws a user-presentable error when `key` has exhausted `ruleName`'s budget. */
export function enforceRateLimit(ruleName: string, key: string): void {
  const decision = actionRateLimiter.check(ruleName, key);
  if (!decision.allowed) {
    throw new Error(
      `Too many requests — try again in ${Math.ceil(decision.retryAfterMs / 1000)} seconds.`,
    );
  }
}
