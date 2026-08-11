import { BLACK, type CrosswordGrid } from "./engine";

export interface CompletionResult {
  complete: boolean;
  correct: boolean;
}

/**
 * Unlike Sudoku (self-verifying via uniqueness) or Nonogram (self-verifying
 * via clue-derivation), a crossword's black-square layout doesn't determine
 * which words are correct — the same layout could hold many different valid
 * fills. So this compares directly against the stored solution grid (SPEC
 * §10: "server validates answer grid"), which the client never receives
 * before completion (see gameDefinition.ts).
 */
export function validateCompletion(solution: CrosswordGrid, submittedGrid: CrosswordGrid): CompletionResult {
  if (solution.length !== submittedGrid.length) {
    throw new Error(`Expected a ${solution.length}-cell grid`);
  }

  const openIndices = solution.reduce<number[]>((acc, cell, i) => {
    if (cell !== BLACK) acc.push(i);
    return acc;
  }, []);

  const complete = openIndices.every((i) => submittedGrid[i] !== "" && submittedGrid[i] !== BLACK);
  if (!complete) {
    return { complete: false, correct: false };
  }

  const correct = openIndices.every((i) => submittedGrid[i].toUpperCase() === solution[i]);
  return { complete: true, correct };
}
