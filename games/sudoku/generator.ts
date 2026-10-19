import { Difficulty } from "@/database/generated/client/enums";
import {
  BLITZ_RULES,
  CLASSIC_RULES,
  EMPTY,
  type SudokuGrid,
  type SudokuRules,
  boxOf,
  colOf,
  emptyGrid,
  rowOf,
} from "./engine";
import { countSolutions } from "./validator";

export const SUDOKU_VARIANTS: Record<Difficulty, string> = {
  [Difficulty.EASY]: "CHALLENGE_6X6_V2",
  [Difficulty.MEDIUM]: "EASY_9X9_V1",
  [Difficulty.HARD]: "HARD_9X9_V1",
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function rulesForDifficulty(difficulty: Difficulty): SudokuRules {
  return difficulty === Difficulty.EASY ? BLITZ_RULES : CLASSIC_RULES;
}

/** Randomized backtracking fill for either supported Sudoku shape. */
export function generateSolvedGrid(rules: SudokuRules = CLASSIC_RULES): SudokuGrid {
  const grid = emptyGrid(rules);
  const cellCount = rules.size * rules.size;
  const rowMask = new Array<number>(rules.size).fill(0);
  const colMask = new Array<number>(rules.size).fill(0);
  const boxMask = new Array<number>(rules.size).fill(0);
  const digits = Array.from({ length: rules.size }, (_, index) => index + 1);

  function backtrack(position: number): boolean {
    if (position === cellCount) return true;
    const row = rowOf(position, rules);
    const col = colOf(position, rules);
    const box = boxOf(position, rules);
    const used = rowMask[row] | colMask[col] | boxMask[box];

    for (const digit of shuffle(digits)) {
      const bit = 1 << digit;
      if (used & bit) continue;
      grid[position] = digit;
      rowMask[row] |= bit;
      colMask[col] |= bit;
      boxMask[box] |= bit;

      if (backtrack(position + 1)) return true;

      grid[position] = EMPTY;
      rowMask[row] &= ~bit;
      colMask[col] &= ~bit;
      boxMask[box] &= ~bit;
    }
    return false;
  }

  backtrack(0);
  return grid;
}

export const DIFFICULTY_TARGET_CLUES: Record<string, number> = {
  [Difficulty.EASY]: 13,
  [Difficulty.MEDIUM]: 40,
  [Difficulty.HARD]: 28,
};

export interface GeneratedPuzzle {
  grid: SudokuGrid;
  solution: SudokuGrid;
  clueCount: number;
  rules: SudokuRules;
}

/** Carves clues while preserving exactly one solution for each public mode. */
export function generatePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const rules = rulesForDifficulty(difficulty);
  const solution = generateSolvedGrid(rules);
  const grid = [...solution];
  const target = DIFFICULTY_TARGET_CLUES[difficulty];

  let clueCount = grid.length;
  for (const index of shuffle(Array.from({ length: grid.length }, (_, value) => value))) {
    if (clueCount <= target) break;
    const backup = grid[index];
    grid[index] = EMPTY;
    if (countSolutions(grid, 2) === 1) clueCount--;
    else grid[index] = backup;
  }

  return { grid, solution, clueCount, rules };
}
