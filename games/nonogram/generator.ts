import { Difficulty } from "@/database/generated/client/enums";
import { FILLED, deriveClues, emptyGrid, type NonogramDimensions, type NonogramGrid } from "./engine";

// Board size is the primary difficulty axis for Nonograms (SPEC's own
// examples: 5x5, 10x10, "potentially 15x15 later").
export const DIFFICULTY_DIMENSIONS: Record<string, NonogramDimensions> = {
  [Difficulty.EASY]: { width: 5, height: 5 },
  [Difficulty.MEDIUM]: { width: 10, height: 10 },
  [Difficulty.HARD]: { width: 15, height: 15 },
};

const FILL_PROBABILITY = 0.5;
const MIN_FILL_FRACTION = 0.2;
const MAX_FILL_FRACTION = 0.8;

export interface GeneratedNonogram {
  dims: NonogramDimensions;
  solution: NonogramGrid;
  rowClues: number[][];
  colClues: number[][];
}

function randomGrid(dims: NonogramDimensions): NonogramGrid {
  const grid = emptyGrid(dims);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < FILL_PROBABILITY ? FILLED : 0;
  }
  return grid;
}

function fillFraction(grid: NonogramGrid): number {
  return grid.filter((cell) => cell === FILLED).length / grid.length;
}

/**
 * Random grid + derived clues. SPEC explicitly lowers the quality bar here
 * vs Sudoku ("puzzle-quality perfection is less important... reasonably
 * solvable") — no logic-solvability or uniqueness solver, just rejecting
 * degenerate near-empty/near-solid grids that would be boring rather than
 * a real puzzle.
 */
export function generatePuzzle(difficulty: Difficulty): GeneratedNonogram {
  const dims = DIFFICULTY_DIMENSIONS[difficulty];

  let grid: NonogramGrid;
  do {
    grid = randomGrid(dims);
  } while (fillFraction(grid) < MIN_FILL_FRACTION || fillFraction(grid) > MAX_FILL_FRACTION);

  const { rowClues, colClues } = deriveClues(grid, dims);
  return { dims, solution: grid, rowClues, colClues };
}
