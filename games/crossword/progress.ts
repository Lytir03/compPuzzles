import { BLACK, decodeGrid, decodePuzzlePayload } from "./engine";

/**
 * Pure — no server/DB dependency — so it can run both server-side (as part
 * of gameDefinition.ts's GameDefinition) and client-side (the ranked match
 * UI computes its own progress locally before emitting match:progress).
 * "Progress" here means cells filled in, not necessarily correct — same
 * cosmetic-only reasoning as Sudoku/Nonogram's versions.
 */
export function calculateProgress(clientPayload: string, currentPayload: string): number {
  const target = decodePuzzlePayload(clientPayload);
  const grid = decodeGrid(currentPayload);
  const total = target.mask.filter((isBlack) => !isBlack).length;
  if (total === 0) return 100;
  const filled = grid.filter((cell, i) => !target.mask[i] && cell !== "" && cell !== BLACK).length;
  return Math.round((filled / total) * 100);
}
