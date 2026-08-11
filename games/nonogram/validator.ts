import {
  cluesEqual,
  deriveClues,
  type NonogramDimensions,
  type NonogramGrid,
  type NonogramPuzzlePayload,
} from "./engine";

export interface CompletionResult {
  complete: boolean;
  correct: boolean;
}

/**
 * A nonogram's row/column clues fully define what counts as a solution —
 * there's no separate "given cells" concept the way Sudoku has, so unlike
 * Sudoku this doesn't need the stored solution grid at all: if the filled
 * cells' derived clues exactly match the puzzle's clues, that grid *is* a
 * valid solution, full stop. (If a puzzle happens to have more than one
 * valid solution, any of them satisfies this check — correctly so, since
 * "first correct completion wins" per SPEC §3 doesn't require matching one
 * canonical answer.) `complete` and `correct` collapse to the same value
 * here since there's no meaningful "full grid but wrong" state distinct
 * from "doesn't match yet" the way Sudoku has mid-fill conflicts.
 */
export function validateCompletion(
  target: NonogramPuzzlePayload,
  submittedGrid: NonogramGrid,
): CompletionResult {
  const dims: NonogramDimensions = { width: target.width, height: target.height };
  if (submittedGrid.length !== dims.width * dims.height) {
    throw new Error(`Expected a ${dims.width * dims.height}-cell grid`);
  }

  const derived = deriveClues(submittedGrid, dims);
  const matches =
    cluesEqual(derived.rowClues, target.rowClues) && cluesEqual(derived.colClues, target.colClues);

  return { complete: matches, correct: matches };
}
