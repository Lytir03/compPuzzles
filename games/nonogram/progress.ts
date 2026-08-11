import { UNDETERMINED, decodeGrid, decodePuzzlePayload } from "./engine";

/**
 * Pure — no server/DB dependency — so it can run both server-side (as part
 * of gameDefinition.ts's GameDefinition) and client-side (the ranked match
 * UI computes its own progress locally before emitting match:progress).
 * "Progress" here means cells decided (filled or marked-X), not
 * necessarily correct — same cosmetic-only reasoning as Sudoku's version.
 */
export function calculateProgress(clientPayload: string, currentPayload: string): number {
  const target = decodePuzzlePayload(clientPayload);
  const grid = decodeGrid(currentPayload);
  const total = target.width * target.height;
  if (total === 0) return 100;
  const decided = grid.filter((cell) => cell !== UNDETERMINED).length;
  return Math.round((decided / total) * 100);
}
