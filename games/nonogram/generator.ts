import { Difficulty } from "@/database/generated/client/enums";
import { FILLED, deriveClues, emptyGrid, type NonogramDimensions, type NonogramGrid } from "./engine";
import { solveNonogramLogically } from "./solver";

// Keep launch matchmaking concentrated in the two most familiar compact
// formats. A 15×15 mode can return later when the player pool supports it.
export const SUPPORTED_NONOGRAM_DIFFICULTIES = [Difficulty.EASY, Difficulty.MEDIUM] as const;

export const DIFFICULTY_DIMENSIONS: Partial<Record<Difficulty, NonogramDimensions>> = {
  [Difficulty.EASY]: { width: 5, height: 5 },
  [Difficulty.MEDIUM]: { width: 10, height: 10 },
};

const FILL_PROBABILITY = 0.5;
const MIN_FILL_FRACTION = 0.2;
const MAX_FILL_FRACTION = 0.8;
const MAX_GENERATION_ATTEMPTS = 2_000;

export interface GeneratedNonogram {
  dims: NonogramDimensions;
  solution: NonogramGrid;
  rowClues: number[][];
  colClues: number[][];
}

export type RandomSource = () => number;

function randomGrid(dims: NonogramDimensions, random: RandomSource): NonogramGrid {
  const grid = emptyGrid(dims);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = random() < FILL_PROBABILITY ? FILLED : 0;
  }
  return grid;
}

function fillFraction(grid: NonogramGrid): number {
  return grid.filter((cell) => cell === FILLED).length / grid.length;
}

/**
 * Generates candidates until the line-domain solver can complete one without
 * branching. Completing the whole board by forced deductions also proves that
 * the accepted clue set has a unique solution.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  random: RandomSource = Math.random,
): GeneratedNonogram {
  const dims = DIFFICULTY_DIMENSIONS[difficulty];
  if (!dims) throw new Error(`Unsupported Nonogram mode: ${difficulty}`);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const grid = randomGrid(dims, random);
    if (fillFraction(grid) < MIN_FILL_FRACTION || fillFraction(grid) > MAX_FILL_FRACTION) continue;

    const { rowClues, colClues } = deriveClues(grid, dims);
    const solved = solveNonogramLogically({ ...dims, rowClues, colClues });
    if (solved.status === "solved") {
      return { dims, solution: grid, rowClues, colClues };
    }
  }

  throw new Error(`Unable to generate a logic-solvable ${difficulty} Nonogram`);
}
