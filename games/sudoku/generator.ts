import { Difficulty } from "@/database/generated/client/enums";
import {
  CELL_COUNT,
  EMPTY,
  GRID_SIZE,
  type SudokuGrid,
  boxOf,
  colOf,
  emptyGrid,
  rowOf,
} from "./engine";
import { countSolutions } from "./validator";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Randomized backtracking fill — produces a uniformly-shuffled valid full grid. */
export function generateSolvedGrid(): SudokuGrid {
  const grid = emptyGrid();
  const rowMask = new Array<number>(GRID_SIZE).fill(0);
  const colMask = new Array<number>(GRID_SIZE).fill(0);
  const boxMask = new Array<number>(GRID_SIZE).fill(0);

  function backtrack(pos: number): boolean {
    if (pos === CELL_COUNT) return true;
    const r = rowOf(pos);
    const c = colOf(pos);
    const b = boxOf(pos);
    const used = rowMask[r] | colMask[c] | boxMask[b];

    for (const digit of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const bit = 1 << digit;
      if (used & bit) continue;

      grid[pos] = digit;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      if (backtrack(pos + 1)) return true;

      grid[pos] = EMPTY;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }
    return false;
  }

  backtrack(0);
  return grid;
}

// A clue-count target per difficulty is a common, simple proxy — fewer
// givens tends to mean harder — not a true solve-technique difficulty
// rating. SPEC doesn't specify a scheme; refining this is exactly what
// `difficultyScore` on SudokuPuzzle exists for later (see docs/SPEC.md §14).
export const DIFFICULTY_TARGET_CLUES: Record<string, number> = {
  [Difficulty.EASY]: 42,
  [Difficulty.MEDIUM]: 34,
  [Difficulty.HARD]: 28,
};

export interface GeneratedPuzzle {
  grid: SudokuGrid;
  solution: SudokuGrid;
  clueCount: number;
}

/**
 * Starts from a full solved grid and removes cells one at a time (random
 * order), keeping each removal only if the puzzle still has exactly one
 * solution. Stops once the target clue count is reached or every cell has
 * been tried — carving toward the true minimum unique-solution puzzle is
 * much slower and isn't necessary for Easy/Medium/Hard buckets.
 */
export function generatePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const solution = generateSolvedGrid();
  const grid = [...solution];
  const target = DIFFICULTY_TARGET_CLUES[difficulty];

  let clueCount = CELL_COUNT;
  for (const idx of shuffle(Array.from({ length: CELL_COUNT }, (_, i) => i))) {
    if (clueCount <= target) break;

    const backup = grid[idx];
    grid[idx] = EMPTY;
    if (countSolutions(grid, 2) === 1) {
      clueCount--;
    } else {
      grid[idx] = backup;
    }
  }

  return { grid, solution, clueCount };
}
