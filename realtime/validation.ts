import { isRankedModeId, type RankedModeId } from "@/games/modes";

/**
 * Input-boundary validation for every client→server socket event.
 *
 * Socket events are an unauthenticated-shape trust boundary exactly like an
 * HTTP endpoint (SPEC §26: "protect websocket events"), but they used to be
 * passed straight through to Prisma and to each game's payload decoder. That
 * meant `{ difficulty: "LOL" }` reached a Prisma enum check and `{ payload:
 * "{" }` reached a bare `JSON.parse` — both throw, and because the handlers
 * were floating promises, a single malformed message could take the whole
 * realtime process down for every player in every live match.
 *
 * These are hand-rolled rather than schema-library-driven to stay consistent
 * with the existing `isValidGrid` helpers in each game's engine, and to avoid
 * adding a dependency for four small shapes.
 */

/** Generous ceiling: the largest legitimate payload is a 15×15 nonogram JSON grid (~1 KB). */
export const MAX_PAYLOAD_LENGTH = 16_384;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

export interface QueueJoinInput {
  modeId: RankedModeId;
}

export function parseQueueJoin(data: unknown): QueueJoinInput | null {
  if (!isRecord(data)) return null;
  if (!hasOnlyKeys(data, ["modeId"])) return null;
  if (!isRankedModeId(data.modeId)) return null;
  return { modeId: data.modeId };
}

export interface MatchProgressInput {
  matchId: string;
  /** Already clamped to an integer 0-100. */
  percent: number;
}

export interface MatchSyncInput {
  matchId: string;
}

export function parseMatchSync(data: unknown): MatchSyncInput | null {
  if (!isRecord(data)) return null;
  if (!hasOnlyKeys(data, ["matchId"])) return null;
  return isId(data.matchId) ? { matchId: data.matchId } : null;
}

export function parseMatchProgress(data: unknown): MatchProgressInput | null {
  if (!isRecord(data)) return null;
  if (!hasOnlyKeys(data, ["matchId", "percent"])) return null;
  const { matchId, percent } = data;
  if (!isId(matchId)) return null;
  // Number.isFinite rejects NaN/Infinity, which the old Math.round/clamp chain
  // let through — NaN survives Math.max/Math.min and was broadcast to opponents.
  if (typeof percent !== "number" || !Number.isFinite(percent)) return null;
  return { matchId, percent: Math.max(0, Math.min(100, Math.round(percent))) };
}

export interface MatchSubmitInput {
  matchId: string;
  payload: string;
}

export function parseMatchSubmit(data: unknown): MatchSubmitInput | null {
  if (!isRecord(data)) return null;
  if (!hasOnlyKeys(data, ["matchId", "payload"])) return null;
  const { matchId, payload } = data;
  if (!isId(matchId)) return null;
  if (typeof payload !== "string" || payload.length === 0 || payload.length > MAX_PAYLOAD_LENGTH) {
    return null;
  }
  return { matchId, payload };
}
