export const EMPTY = 0;

export interface SudokuRules {
  size: number;
  boxRows: number;
  boxCols: number;
}

export const CLASSIC_RULES: SudokuRules = { size: 9, boxRows: 3, boxCols: 3 };
export const BLITZ_RULES: SudokuRules = { size: 6, boxRows: 2, boxCols: 3 };

// Backwards-compatible names for classic Sudoku callers and pinned tests.
export const GRID_SIZE = CLASSIC_RULES.size;
export const BOX_SIZE = CLASSIC_RULES.boxRows;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/** In-memory row-major grid. Zero is empty; valid digits are 1..rules.size. */
export type SudokuGrid = number[];

export function rulesForCellCount(cellCount: number): SudokuRules {
  if (cellCount === BLITZ_RULES.size ** 2) return BLITZ_RULES;
  if (cellCount === CLASSIC_RULES.size ** 2) return CLASSIC_RULES;
  throw new Error(`Unsupported Sudoku grid with ${cellCount} cells`);
}

export function rulesForGrid(grid: SudokuGrid): SudokuRules {
  return rulesForCellCount(grid.length);
}

export function cellIndex(row: number, col: number, rules: SudokuRules = CLASSIC_RULES): number {
  return row * rules.size + col;
}

export function rowOf(index: number, rules: SudokuRules = CLASSIC_RULES): number {
  return Math.floor(index / rules.size);
}

export function colOf(index: number, rules: SudokuRules = CLASSIC_RULES): number {
  return index % rules.size;
}

export function boxOf(index: number, rules: SudokuRules = CLASSIC_RULES): number {
  const boxesPerRow = rules.size / rules.boxCols;
  return (
    Math.floor(rowOf(index, rules) / rules.boxRows) * boxesPerRow +
    Math.floor(colOf(index, rules) / rules.boxCols)
  );
}

/** Indices of every cell sharing a row, column, or box with `index` (self excluded). */
export function peersOf(index: number, rules: SudokuRules = CLASSIC_RULES): number[] {
  const row = rowOf(index, rules);
  const col = colOf(index, rules);
  const boxRow = Math.floor(row / rules.boxRows) * rules.boxRows;
  const boxCol = Math.floor(col / rules.boxCols) * rules.boxCols;

  const peers = new Set<number>();
  for (let c = 0; c < rules.size; c++) peers.add(cellIndex(row, c, rules));
  for (let r = 0; r < rules.size; r++) peers.add(cellIndex(r, col, rules));
  for (let r = boxRow; r < boxRow + rules.boxRows; r++) {
    for (let c = boxCol; c < boxCol + rules.boxCols; c++) {
      peers.add(cellIndex(r, c, rules));
    }
  }
  peers.delete(index);
  return [...peers];
}

/** DB/wire format: one digit per cell, with zero representing an empty cell. */
export function gridToString(grid: SudokuGrid): string {
  return grid.join("");
}

export function gridFromString(value: string): SudokuGrid {
  if (!/^\d+$/.test(value)) throw new Error("Sudoku grid must contain only digits");
  const rules = rulesForCellCount(value.length);
  const grid = value.split("").map(Number);
  if (grid.some((digit) => digit < EMPTY || digit > rules.size)) {
    throw new Error(`A ${rules.size}×${rules.size} Sudoku only accepts digits 0-${rules.size}`);
  }
  return grid;
}

export function emptyGrid(rules: SudokuRules = CLASSIC_RULES): SudokuGrid {
  return new Array(rules.size * rules.size).fill(EMPTY);
}

export { formatElapsed } from "@/lib/formatElapsed";
