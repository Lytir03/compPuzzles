import {
  FLAGGED,
  HIDDEN,
  adjacentMineCount,
  neighbors,
  type MineMap,
  type MinesweeperDimensions,
  type MinesweeperView,
} from "./engine";

export type MinesweeperSolveStatus = "solved" | "stalled" | "contradiction";

export interface MinesweeperSolveResult {
  status: MinesweeperSolveStatus;
  view: MinesweeperView;
  passes: number;
  deductions: number;
}

interface Constraint {
  cells: number[];
  mines: number;
}

function isSubset(smaller: number[], larger: number[]): boolean {
  const largerSet = new Set(larger);
  return smaller.every((cell) => largerSet.has(cell));
}

function difference(larger: number[], smaller: number[]): number[] {
  const smallerSet = new Set(smaller);
  return larger.filter((cell) => !smallerSet.has(cell));
}

/**
 * Applies the normal Minesweeper number rules plus subset deductions. It never
 * opens a cell unless every mine arrangement consistent with those constraints
 * says that the cell is safe.
 */
export function solveMinesweeperLogically(
  mines: MineMap,
  dims: MinesweeperDimensions,
  mineCount: number,
  openingCell: number,
): MinesweeperSolveResult {
  const view: MinesweeperView = new Array(mines.length).fill(HIDDEN);
  let passes = 0;
  let deductions = 0;
  let contradiction = false;

  const reveal = (initialCells: Iterable<number>): boolean => {
    const queue = [...initialCells];
    let changed = false;

    while (queue.length > 0) {
      const cell = queue.pop()!;
      if (view[cell] !== HIDDEN) continue;
      if (mines[cell]) {
        contradiction = true;
        return changed;
      }

      const count = adjacentMineCount(mines, dims, cell);
      view[cell] = count;
      deductions++;
      changed = true;
      if (count === 0) {
        for (const neighbor of neighbors(dims, cell)) {
          if (view[neighbor] === HIDDEN) queue.push(neighbor);
        }
      }
    }

    return changed;
  };

  const flag = (cells: Iterable<number>): boolean => {
    let changed = false;
    for (const cell of cells) {
      if (view[cell] === HIDDEN) {
        view[cell] = FLAGGED;
        deductions++;
        changed = true;
      } else if (view[cell] !== FLAGGED) {
        contradiction = true;
      }
    }
    return changed;
  };

  reveal([openingCell]);
  if (contradiction) return { status: "contradiction", view, passes, deductions };

  while (true) {
    passes++;
    let changed = false;
    const constraints: Constraint[] = [];

    for (let cell = 0; cell < view.length; cell++) {
      if (view[cell] < 0) continue;
      const adjacent = neighbors(dims, cell);
      const unknown = adjacent.filter((neighbor) => view[neighbor] === HIDDEN);
      const flagged = adjacent.filter((neighbor) => view[neighbor] === FLAGGED).length;
      const remainingMines = view[cell] - flagged;

      if (remainingMines < 0 || remainingMines > unknown.length) {
        return { status: "contradiction", view, passes, deductions };
      }
      if (unknown.length === 0) continue;
      constraints.push({ cells: unknown.sort((a, b) => a - b), mines: remainingMines });
    }

    const safe = new Set<number>();
    const certainMines = new Set<number>();

    const applyConstraint = (constraint: Constraint): void => {
      if (constraint.mines === 0) constraint.cells.forEach((cell) => safe.add(cell));
      if (constraint.mines === constraint.cells.length) {
        constraint.cells.forEach((cell) => certainMines.add(cell));
      }
    };

    constraints.forEach(applyConstraint);

    // A-B reasoning: if every cell in A is also in B, the cells in B-A must
    // contain exactly B.mines-A.mines mines.
    for (let left = 0; left < constraints.length; left++) {
      for (let right = 0; right < constraints.length; right++) {
        if (left === right) continue;
        const smaller = constraints[left];
        const larger = constraints[right];
        if (smaller.cells.length >= larger.cells.length || !isSubset(smaller.cells, larger.cells)) continue;

        const cells = difference(larger.cells, smaller.cells);
        const minesInDifference = larger.mines - smaller.mines;
        if (minesInDifference < 0 || minesInDifference > cells.length) {
          return { status: "contradiction", view, passes, deductions };
        }
        applyConstraint({ cells, mines: minesInDifference });
      }
    }

    const flagsPlaced = view.filter((cell) => cell === FLAGGED).length;
    const allHidden = view
      .map((cell, index) => (cell === HIDDEN ? index : -1))
      .filter((cell) => cell >= 0);
    const globallyRemaining = mineCount - flagsPlaced;
    if (globallyRemaining === 0) allHidden.forEach((cell) => safe.add(cell));
    if (globallyRemaining === allHidden.length) allHidden.forEach((cell) => certainMines.add(cell));

    for (const cell of safe) {
      if (certainMines.has(cell)) return { status: "contradiction", view, passes, deductions };
    }

    changed = flag(certainMines) || changed;
    changed = reveal(safe) || changed;
    if (contradiction) return { status: "contradiction", view, passes, deductions };

    const hiddenSafeCells = view.some((cell, index) => cell === HIDDEN && !mines[index]);
    if (!hiddenSafeCells) {
      flag(view.map((cell, index) => (cell === HIDDEN ? index : -1)).filter((cell) => cell >= 0));
      return { status: "solved", view, passes, deductions };
    }
    if (!changed) return { status: "stalled", view, passes, deductions };
  }
}
