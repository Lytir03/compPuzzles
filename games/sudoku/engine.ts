export const GRID_SIZE = 9;
export const BOX_SIZE = 3;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const EMPTY = 0;

/** In-memory grid: 81 entries, row-major, 0 = empty, 1-9 = filled. */
export type SudokuGrid = number[];

export function cellIndex(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

export function rowOf(index: number): number {
  return Math.floor(index / GRID_SIZE);
}

export function colOf(index: number): number {
  return index % GRID_SIZE;
}

export function boxOf(index: number): number {
  return Math.floor(rowOf(index) / BOX_SIZE) * BOX_SIZE + Math.floor(colOf(index) / BOX_SIZE);
}

/** Indices of every cell sharing a row, column, or box with `index` (self excluded). */
export function peersOf(index: number): number[] {
  const row = rowOf(index);
  const col = colOf(index);
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;

  const peers = new Set<number>();
  for (let c = 0; c < GRID_SIZE; c++) peers.add(cellIndex(row, c));
  for (let r = 0; r < GRID_SIZE; r++) peers.add(cellIndex(r, col));
  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) peers.add(cellIndex(r, c));
  }
  peers.delete(index);
  return [...peers];
}

/** DB/wire format: 81-char string, '0' = empty. Matches SudokuPuzzle.grid/solution. */
export function gridToString(grid: SudokuGrid): string {
  return grid.join("");
}

export function gridFromString(value: string): SudokuGrid {
  if (value.length !== CELL_COUNT) {
    throw new Error(`Expected a ${CELL_COUNT}-character grid string, got ${value.length}`);
  }
  return value.split("").map(Number);
}

export function emptyGrid(): SudokuGrid {
  return new Array(CELL_COUNT).fill(EMPTY);
}

export { formatElapsed } from "@/lib/formatElapsed";
