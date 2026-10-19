import {
  EMPTY,
  type SudokuGrid,
  type SudokuRules,
  boxOf,
  cellIndex,
  colOf,
  rowOf,
  rulesForGrid,
} from "./engine";

function buildUnits(rules: SudokuRules): number[][] {
  const units: number[][] = [];
  for (let row = 0; row < rules.size; row++) {
    units.push(Array.from({ length: rules.size }, (_, col) => cellIndex(row, col, rules)));
  }
  for (let col = 0; col < rules.size; col++) {
    units.push(Array.from({ length: rules.size }, (_, row) => cellIndex(row, col, rules)));
  }
  for (let boxRow = 0; boxRow < rules.size; boxRow += rules.boxRows) {
    for (let boxCol = 0; boxCol < rules.size; boxCol += rules.boxCols) {
      const box: number[] = [];
      for (let row = boxRow; row < boxRow + rules.boxRows; row++) {
        for (let col = boxCol; col < boxCol + rules.boxCols; col++) {
          box.push(cellIndex(row, col, rules));
        }
      }
      units.push(box);
    }
  }
  return units;
}

/** Indices of every filled cell that shares a row/column/box with an equal value. */
export function findConflicts(grid: SudokuGrid): Set<number> {
  const rules = rulesForGrid(grid);
  const conflicts = new Set<number>();
  for (const unit of buildUnits(rules)) {
    const seenAt = new Map<number, number[]>();
    for (const index of unit) {
      const value = grid[index];
      if (value === EMPTY) continue;
      const indices = seenAt.get(value) ?? [];
      indices.push(index);
      seenAt.set(value, indices);
    }
    for (const indices of seenAt.values()) {
      if (indices.length > 1) indices.forEach((index) => conflicts.add(index));
    }
  }
  return conflicts;
}

export function isGridFull(grid: SudokuGrid): boolean {
  return grid.every((value) => value !== EMPTY);
}

function popcount(mask: number): number {
  let count = 0;
  for (let remaining = mask; remaining !== 0; count++) remaining &= remaining - 1;
  return count;
}

/** MRV backtracking solver shared by the 6×6 and 9×9 generators. */
function search(grid: SudokuGrid, limit: number): SudokuGrid[] {
  const rules = rulesForGrid(grid);
  if (findConflicts(grid).size > 0) return [];

  const working = [...grid];
  const rowMask = new Array<number>(rules.size).fill(0);
  const colMask = new Array<number>(rules.size).fill(0);
  const boxMask = new Array<number>(rules.size).fill(0);
  const remaining = new Set<number>();
  const allDigitsMask = (1 << (rules.size + 1)) - 2;

  for (let index = 0; index < working.length; index++) {
    const value = working[index];
    if (value === EMPTY) {
      remaining.add(index);
      continue;
    }
    const bit = 1 << value;
    rowMask[rowOf(index, rules)] |= bit;
    colMask[colOf(index, rules)] |= bit;
    boxMask[boxOf(index, rules)] |= bit;
  }

  const solutions: SudokuGrid[] = [];
  const candidatesFor = (index: number) =>
    allDigitsMask &
    ~(rowMask[rowOf(index, rules)] | colMask[colOf(index, rules)] | boxMask[boxOf(index, rules)]);

  function pickNextCell(): number | null {
    let best: number | null = null;
    let bestCount = rules.size + 1;
    for (const index of remaining) {
      const count = popcount(candidatesFor(index));
      if (count === 0) return index;
      if (count < bestCount) {
        bestCount = count;
        best = index;
        if (count === 1) break;
      }
    }
    return best;
  }

  function backtrack(): boolean {
    if (remaining.size === 0) {
      solutions.push([...working]);
      return solutions.length >= limit;
    }

    const index = pickNextCell();
    if (index === null) return false;
    const candidates = candidatesFor(index);
    if (candidates === 0) return false;

    const row = rowOf(index, rules);
    const col = colOf(index, rules);
    const box = boxOf(index, rules);
    remaining.delete(index);

    for (let digit = 1; digit <= rules.size; digit++) {
      const bit = 1 << digit;
      if (!(candidates & bit)) continue;
      working[index] = digit;
      rowMask[row] |= bit;
      colMask[col] |= bit;
      boxMask[box] |= bit;

      if (backtrack()) return true;

      working[index] = EMPTY;
      rowMask[row] &= ~bit;
      colMask[col] &= ~bit;
      boxMask[box] &= ~bit;
    }

    remaining.add(index);
    return false;
  }

  backtrack();
  return solutions;
}

export function solve(grid: SudokuGrid): SudokuGrid | null {
  return search(grid, 1)[0] ?? null;
}

export function countSolutions(grid: SudokuGrid, limit = 2): number {
  return search(grid, limit).length;
}

export interface CompletionResult {
  complete: boolean;
  correct: boolean;
}

export function validateCompletion(
  givenGrid: SudokuGrid,
  submittedGrid: SudokuGrid,
): CompletionResult {
  if (givenGrid.length !== submittedGrid.length) {
    throw new Error("Given and submitted Sudoku grids must have the same size");
  }
  // Also rejects unsupported lengths before any validation work.
  const rules = rulesForGrid(givenGrid);
  if (!Array.from(submittedGrid).every((value) => Number.isInteger(value) && value >= EMPTY && value <= rules.size)) {
    return { complete: false, correct: false };
  }

  if (!isGridFull(submittedGrid)) return { complete: false, correct: false };

  const preservesGivens = givenGrid.every(
    (value, index) => value === EMPTY || value === submittedGrid[index],
  );
  const hasConflicts = findConflicts(submittedGrid).size > 0;
  return { complete: true, correct: preservesGivens && !hasConflicts };
}
