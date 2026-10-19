import {
  FILLED,
  MARKED_EMPTY,
  UNDETERMINED,
  cellIndex,
  emptyGrid,
  getColumn,
  getRow,
  type NonogramGrid,
  type NonogramPuzzlePayload,
} from "./engine";

export type NonogramSolveStatus = "solved" | "stalled" | "contradiction";

export interface NonogramSolveResult {
  status: NonogramSolveStatus;
  grid: NonogramGrid;
  passes: number;
  deductions: number;
}

/**
 * Enumerate every placement of a line's runs. This is deliberately bounded by
 * the current maximum line length (15), where even the unconstrained search
 * space is only 2^15 patterns.
 */
export function enumerateLinePatterns(length: number, clues: number[]): number[][] {
  if (clues.length === 0) return [new Array(length).fill(MARKED_EMPTY)];

  const patterns: number[][] = [];
  const pattern = new Array(length).fill(MARKED_EMPTY);

  function placeRun(clueIndex: number, earliestStart: number): void {
    if (clueIndex === clues.length) {
      patterns.push([...pattern]);
      return;
    }

    const runLength = clues[clueIndex];
    const remainingLength = clues
      .slice(clueIndex + 1)
      .reduce((sum, run) => sum + run, Math.max(0, clues.length - clueIndex - 1));
    const latestStart = length - runLength - remainingLength;

    for (let start = earliestStart; start <= latestStart; start++) {
      for (let offset = 0; offset < runLength; offset++) {
        pattern[start + offset] = FILLED;
      }

      placeRun(clueIndex + 1, start + runLength + 1);

      for (let offset = 0; offset < runLength; offset++) {
        pattern[start + offset] = MARKED_EMPTY;
      }
    }
  }

  placeRun(0, 0);
  return patterns;
}

function compatible(pattern: number[], known: number[]): boolean {
  return pattern.every((cell, index) => known[index] === UNDETERMINED || known[index] === cell);
}

function forcedCells(patterns: number[][]): number[] {
  const forced = [...patterns[0]];
  for (let patternIndex = 1; patternIndex < patterns.length; patternIndex++) {
    for (let cell = 0; cell < forced.length; cell++) {
      if (forced[cell] !== patterns[patternIndex][cell]) forced[cell] = UNDETERMINED;
    }
  }
  return forced;
}

/**
 * Solves only by deductions shared by every currently valid row/column
 * placement. It never branches, assumes a cell, or chooses between candidates.
 */
export function solveNonogramLogically(
  puzzle: NonogramPuzzlePayload,
  initialGrid: NonogramGrid = emptyGrid(puzzle),
): NonogramSolveResult {
  const grid = [...initialGrid];
  const rowPatterns = puzzle.rowClues.map((clues) => enumerateLinePatterns(puzzle.width, clues));
  const colPatterns = puzzle.colClues.map((clues) => enumerateLinePatterns(puzzle.height, clues));
  let passes = 0;
  let deductions = 0;

  while (true) {
    passes++;
    let changed = false;

    for (let row = 0; row < puzzle.height; row++) {
      const candidates = rowPatterns[row].filter((pattern) => compatible(pattern, getRow(grid, puzzle, row)));
      if (candidates.length === 0) return { status: "contradiction", grid, passes, deductions };

      const forced = forcedCells(candidates);
      for (let col = 0; col < puzzle.width; col++) {
        const index = cellIndex(puzzle, row, col);
        if (grid[index] === UNDETERMINED && forced[col] !== UNDETERMINED) {
          grid[index] = forced[col];
          deductions++;
          changed = true;
        }
      }
    }

    for (let col = 0; col < puzzle.width; col++) {
      const candidates = colPatterns[col].filter((pattern) =>
        compatible(pattern, getColumn(grid, puzzle, col)),
      );
      if (candidates.length === 0) return { status: "contradiction", grid, passes, deductions };

      const forced = forcedCells(candidates);
      for (let row = 0; row < puzzle.height; row++) {
        const index = cellIndex(puzzle, row, col);
        if (grid[index] === UNDETERMINED && forced[row] !== UNDETERMINED) {
          grid[index] = forced[row];
          deductions++;
          changed = true;
        }
      }
    }

    if (!grid.includes(UNDETERMINED)) return { status: "solved", grid, passes, deductions };
    if (!changed) return { status: "stalled", grid, passes, deductions };
  }
}
