export const UNDETERMINED = 0;
export const FILLED = 1;
export const MARKED_EMPTY = 2;

/** Per-cell state: 0 = undetermined, 1 = filled, 2 = marked empty (X) — row-major. */
export type NonogramGrid = number[];

export interface NonogramDimensions {
  width: number;
  height: number;
}

export function cellIndex(dims: NonogramDimensions, row: number, col: number): number {
  return row * dims.width + col;
}

export function emptyGrid(dims: NonogramDimensions): NonogramGrid {
  return new Array(dims.width * dims.height).fill(UNDETERMINED);
}

export function isFilled(cell: number): boolean {
  return cell === FILLED;
}

export function getRow(grid: NonogramGrid, dims: NonogramDimensions, row: number): number[] {
  const start = row * dims.width;
  return grid.slice(start, start + dims.width);
}

export function getColumn(grid: NonogramGrid, dims: NonogramDimensions, col: number): number[] {
  const column: number[] = [];
  for (let row = 0; row < dims.height; row++) {
    column.push(grid[cellIndex(dims, row, col)]);
  }
  return column;
}

/** Run-length clue for one line of cells, e.g. [T,F,T,T] -> [1, 2]. Empty line -> []. */
export function deriveLineClue(line: number[]): number[] {
  const clue: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (isFilled(cell)) {
      run++;
    } else if (run > 0) {
      clue.push(run);
      run = 0;
    }
  }
  if (run > 0) clue.push(run);
  return clue;
}

export interface NonogramClues {
  rowClues: number[][];
  colClues: number[][];
}

/** Derives the full clue set from a (fully or partially) filled grid. */
export function deriveClues(grid: NonogramGrid, dims: NonogramDimensions): NonogramClues {
  const rowClues: number[][] = [];
  for (let row = 0; row < dims.height; row++) {
    rowClues.push(deriveLineClue(getRow(grid, dims, row)));
  }
  const colClues: number[][] = [];
  for (let col = 0; col < dims.width; col++) {
    colClues.push(deriveLineClue(getColumn(grid, dims, col)));
  }
  return { rowClues, colClues };
}

export function cluesEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

export interface NonogramPuzzlePayload extends NonogramDimensions {
  rowClues: number[][];
  colClues: number[][];
}

/** Input-boundary validation for a decoded grid before trusting its shape. */
export function isValidGrid(grid: unknown, dims: NonogramDimensions): grid is NonogramGrid {
  return (
    Array.isArray(grid) &&
    grid.length === dims.width * dims.height &&
    grid.every((cell) => cell === UNDETERMINED || cell === FILLED || cell === MARKED_EMPTY)
  );
}

/**
 * Wire format for both the puzzle prompt (client payload — safe, no
 * solution) and a submitted/in-progress grid: plain JSON strings, matching
 * Sudoku's string-payload convention on GameDefinition/socket events.
 */
export function encodePuzzlePayload(payload: NonogramPuzzlePayload): string {
  return JSON.stringify(payload);
}

export function decodePuzzlePayload(payload: string): NonogramPuzzlePayload {
  return JSON.parse(payload) as NonogramPuzzlePayload;
}

export function encodeGrid(grid: NonogramGrid): string {
  return JSON.stringify(grid);
}

export function decodeGrid(payload: string): NonogramGrid {
  return JSON.parse(payload) as NonogramGrid;
}

export { formatElapsed } from "@/lib/formatElapsed";
