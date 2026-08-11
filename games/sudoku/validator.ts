import {
  BOX_SIZE,
  CELL_COUNT,
  EMPTY,
  GRID_SIZE,
  type SudokuGrid,
  boxOf,
  cellIndex,
  colOf,
  rowOf,
} from "./engine";

function buildUnits(): number[][] {
  const units: number[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    units.push(Array.from({ length: GRID_SIZE }, (_, c) => cellIndex(r, c)));
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    units.push(Array.from({ length: GRID_SIZE }, (_, r) => cellIndex(r, c)));
  }
  for (let boxRow = 0; boxRow < GRID_SIZE; boxRow += BOX_SIZE) {
    for (let boxCol = 0; boxCol < GRID_SIZE; boxCol += BOX_SIZE) {
      const box: number[] = [];
      for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
        for (let c = boxCol; c < boxCol + BOX_SIZE; c++) box.push(cellIndex(r, c));
      }
      units.push(box);
    }
  }
  return units;
}

const UNITS = buildUnits();

/** Indices of every filled cell that shares a row/col/box with an equal value. */
export function findConflicts(grid: SudokuGrid): Set<number> {
  const conflicts = new Set<number>();
  for (const unit of UNITS) {
    const seenAt = new Map<number, number[]>();
    for (const idx of unit) {
      const value = grid[idx];
      if (value === EMPTY) continue;
      const indices = seenAt.get(value) ?? [];
      indices.push(idx);
      seenAt.set(value, indices);
    }
    for (const indices of seenAt.values()) {
      if (indices.length > 1) {
        for (const idx of indices) conflicts.add(idx);
      }
    }
  }
  return conflicts;
}

export function isGridFull(grid: SudokuGrid): boolean {
  return grid.every((value) => value !== EMPTY);
}

const ALL_DIGITS_MASK = 0b1111111110; // bits 1-9

function popcount(mask: number): number {
  let count = 0;
  for (let m = mask; m !== 0; count++) {
    m &= m - 1;
  }
  return count;
}

/**
 * Backtracking search with bitmasked row/col/box constraints and a
 * minimum-remaining-values heuristic: always branch on the empty cell with
 * the fewest legal digits left, so dead ends surface immediately instead of
 * many moves later. Plain fixed-order backtracking is fast on easy grids but
 * blows up badly on some 26-30-clue ones — MRV is the standard fix and is
 * what keeps puzzle carving (many uniqueness checks per generated puzzle)
 * fast.
 *
 * Given cells that already conflict with each other are checked up front
 * and short-circuit to zero solutions. Without this, proving a grid with
 * conflicting givens has no solution means exhausting a huge fraction of
 * the search space — even MRV doesn't help there, since the contradiction
 * is between two fixed cells the search never revisits.
 */
function search(grid: SudokuGrid, limit: number): SudokuGrid[] {
  if (findConflicts(grid).size > 0) return [];

  const working = [...grid];
  const rowMask = new Array<number>(GRID_SIZE).fill(0);
  const colMask = new Array<number>(GRID_SIZE).fill(0);
  const boxMask = new Array<number>(GRID_SIZE).fill(0);
  const remaining = new Set<number>();

  for (let i = 0; i < CELL_COUNT; i++) {
    const value = working[i];
    if (value === EMPTY) {
      remaining.add(i);
      continue;
    }
    const bit = 1 << value;
    rowMask[rowOf(i)] |= bit;
    colMask[colOf(i)] |= bit;
    boxMask[boxOf(i)] |= bit;
  }

  const solutions: SudokuGrid[] = [];

  function candidatesFor(idx: number): number {
    const used = rowMask[rowOf(idx)] | colMask[colOf(idx)] | boxMask[boxOf(idx)];
    return ALL_DIGITS_MASK & ~used;
  }

  /** The empty cell with fewest candidates, or null if none remain. */
  function pickNextCell(): number | null {
    let best: number | null = null;
    let bestCount = 10;
    for (const idx of remaining) {
      const count = popcount(candidatesFor(idx));
      if (count === 0) return idx; // dead end — fail fast rather than keep scanning
      if (count < bestCount) {
        bestCount = count;
        best = idx;
        if (count === 1) break; // can't do better than a forced cell
      }
    }
    return best;
  }

  function backtrack(): boolean {
    if (remaining.size === 0) {
      solutions.push([...working]);
      return solutions.length >= limit;
    }

    const idx = pickNextCell();
    if (idx === null) return false;
    const candidates = candidatesFor(idx);
    if (candidates === 0) return false;

    const r = rowOf(idx);
    const c = colOf(idx);
    const b = boxOf(idx);
    remaining.delete(idx);

    for (let digit = 1; digit <= 9; digit++) {
      const bit = 1 << digit;
      if (!(candidates & bit)) continue;

      working[idx] = digit;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      if (backtrack()) return true;

      working[idx] = EMPTY;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }

    remaining.add(idx);
    return false;
  }

  backtrack();
  return solutions;
}

export function solve(grid: SudokuGrid): SudokuGrid | null {
  return search(grid, 1)[0] ?? null;
}

/** Counts solutions up to `limit` (default 2 — just enough to prove uniqueness). */
export function countSolutions(grid: SudokuGrid, limit = 2): number {
  return search(grid, limit).length;
}

export interface CompletionResult {
  complete: boolean;
  correct: boolean;
}

/**
 * Correctness doesn't require the stored solution: a fully-filled grid with
 * no row/col/box conflicts that preserves every given clue IS the solution,
 * because the puzzle was generated with exactly one. Keeping the solution
 * out of this check means it never has to reach the client either.
 */
export function validateCompletion(
  givenGrid: SudokuGrid,
  submittedGrid: SudokuGrid,
): CompletionResult {
  if (givenGrid.length !== CELL_COUNT || submittedGrid.length !== CELL_COUNT) {
    throw new Error("Grid must have 81 cells");
  }

  if (!isGridFull(submittedGrid)) {
    return { complete: false, correct: false };
  }

  const preservesGivens = givenGrid.every(
    (value, idx) => value === EMPTY || value === submittedGrid[idx],
  );
  const hasConflicts = findConflicts(submittedGrid).size > 0;

  return { complete: true, correct: preservesGivens && !hasConflicts };
}
