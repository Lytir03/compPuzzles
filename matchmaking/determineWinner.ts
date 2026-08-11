export interface ParticipantOutcome {
  userId: string;
  /** Server-confirmed correct completion time, or null if not completed yet. */
  completionTimeMs: number | null;
  mistakes: number;
  /** True once their disconnect grace period has expired (abandoned). */
  disconnected: boolean;
}

export type MatchOutcome =
  | { type: "winner"; winnerUserId: string; reason: "completion" | "abandonment" }
  | { type: "draw" };

/**
 * Shared win-condition rule for every game (see gameDefinition.ts for why
 * this isn't per-game): opponent abandonment wins outright; otherwise the
 * first correct completion wins, tied first by time then by mistake count.
 * Returns null when neither condition is met yet — the match is still in
 * progress and no decision should be made.
 *
 * Called by the realtime server after every event that could end a match
 * (a correct submission, or a disconnect grace period expiring), not just
 * once at the end — this is what lets both "first to solve" and "opponent
 * abandoned" collapse into one decision point instead of scattered if/else.
 */
export function determineWinner(
  participants: [ParticipantOutcome, ParticipantOutcome],
): MatchOutcome | null {
  const [a, b] = participants;

  if (a.disconnected && b.disconnected) {
    return { type: "draw" };
  }
  if (a.disconnected) {
    return { type: "winner", winnerUserId: b.userId, reason: "abandonment" };
  }
  if (b.disconnected) {
    return { type: "winner", winnerUserId: a.userId, reason: "abandonment" };
  }

  const aDone = a.completionTimeMs !== null;
  const bDone = b.completionTimeMs !== null;

  if (aDone && !bDone) return { type: "winner", winnerUserId: a.userId, reason: "completion" };
  if (bDone && !aDone) return { type: "winner", winnerUserId: b.userId, reason: "completion" };
  if (!aDone && !bDone) return null;

  // Both completed (near-simultaneous submissions) — time, then mistakes, decide it.
  if (a.completionTimeMs! < b.completionTimeMs!) {
    return { type: "winner", winnerUserId: a.userId, reason: "completion" };
  }
  if (b.completionTimeMs! < a.completionTimeMs!) {
    return { type: "winner", winnerUserId: b.userId, reason: "completion" };
  }
  if (a.mistakes < b.mistakes) return { type: "winner", winnerUserId: a.userId, reason: "completion" };
  if (b.mistakes < a.mistakes) return { type: "winner", winnerUserId: b.userId, reason: "completion" };
  return { type: "draw" };
}
