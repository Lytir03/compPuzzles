import { describe, expect, it } from "vitest";
import {
  FILLED,
  MARKED_EMPTY,
  UNDETERMINED,
  cellIndex,
  cluesEqual,
  deriveClues,
  deriveLineClue,
  emptyGrid,
  getColumn,
  getRow,
  isValidGrid,
} from "./engine";

describe("deriveLineClue", () => {
  it("returns [] for an all-empty line", () => {
    expect(deriveLineClue([0, 0, 0, 0])).toEqual([]);
  });

  it("returns a single run for a fully-filled line", () => {
    expect(deriveLineClue([FILLED, FILLED, FILLED])).toEqual([3]);
  });

  it("splits separated runs correctly", () => {
    expect(deriveLineClue([FILLED, 0, FILLED, FILLED, 0, 0, FILLED])).toEqual([1, 2, 1]);
  });

  it("treats marked-empty the same as undetermined (not filled)", () => {
    expect(deriveLineClue([FILLED, MARKED_EMPTY, FILLED])).toEqual([1, 1]);
  });

  it("handles a run at the very end of the line", () => {
    expect(deriveLineClue([0, 0, FILLED, FILLED])).toEqual([2]);
  });
});

describe("deriveClues", () => {
  it("derives both row and column clues for a small grid", () => {
    const dims = { width: 3, height: 2 };
    // Row 0: X . X   Row 1: X X X
    const grid = [FILLED, 0, FILLED, FILLED, FILLED, FILLED];
    const { rowClues, colClues } = deriveClues(grid, dims);
    expect(rowClues).toEqual([[1, 1], [3]]);
    expect(colClues).toEqual([[2], [1], [2]]);
  });

  it("round-trips through getRow/getColumn/cellIndex consistently", () => {
    const dims = { width: 4, height: 3 };
    const grid = emptyGrid(dims);
    grid[cellIndex(dims, 1, 2)] = FILLED;
    expect(getRow(grid, dims, 1)).toEqual([0, 0, FILLED, 0]);
    expect(getColumn(grid, dims, 2)).toEqual([0, FILLED, 0]);
  });
});

describe("cluesEqual", () => {
  it("is true for identical clue sets", () => {
    expect(cluesEqual([[1, 2], [3]], [[1, 2], [3]])).toBe(true);
  });

  it("is false when a line's clue differs", () => {
    expect(cluesEqual([[1, 2]], [[1, 3]])).toBe(false);
  });

  it("is false when clue array lengths differ", () => {
    expect(cluesEqual([[1], [2]], [[1]])).toBe(false);
  });

  it("treats [] (empty line) consistently", () => {
    expect(cluesEqual([[]], [[]])).toBe(true);
    expect(cluesEqual([[]], [[1]])).toBe(false);
  });
});

describe("isValidGrid", () => {
  const dims = { width: 2, height: 2 };

  it("accepts a well-formed grid of the right size", () => {
    expect(isValidGrid([FILLED, UNDETERMINED, MARKED_EMPTY, FILLED], dims)).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidGrid([FILLED, UNDETERMINED, MARKED_EMPTY], dims)).toBe(false);
  });

  it("rejects out-of-range cell values", () => {
    expect(isValidGrid([FILLED, 5, MARKED_EMPTY, UNDETERMINED], dims)).toBe(false);
  });

  it("rejects non-array input", () => {
    expect(isValidGrid("not a grid", dims)).toBe(false);
    expect(isValidGrid(null, dims)).toBe(false);
  });
});

describe("emptyGrid", () => {
  it("creates a grid of the right size, all undetermined", () => {
    const grid = emptyGrid({ width: 5, height: 5 });
    expect(grid).toHaveLength(25);
    expect(grid.every((cell) => cell === UNDETERMINED)).toBe(true);
  });
});
