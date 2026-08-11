import { describe, expect, it } from "vitest";
import { emptyGrid, gridFromString } from "./engine";
import { countSolutions, findConflicts, isGridFull, solve, validateCompletion } from "./validator";

// A verified unique-solution puzzle/solution pair (generated once via our
// own generator, then pinned here so these tests don't depend on it).
const KNOWN_PUZZLE =
  "000047000000860070700025060600009007009000080584600003060000720100036000400050900";
const KNOWN_SOLUTION =
  "856947312912863574743125869631589247279314685584672193365498721197236458428751936";

describe("findConflicts", () => {
  it("returns empty for an empty grid", () => {
    expect(findConflicts(emptyGrid()).size).toBe(0);
  });

  it("flags two cells sharing a row with the same value", () => {
    const grid = emptyGrid();
    grid[0] = 5;
    grid[3] = 5;
    const conflicts = findConflicts(grid);
    expect(conflicts.has(0)).toBe(true);
    expect(conflicts.has(3)).toBe(true);
    expect(conflicts.size).toBe(2);
  });

  it("flags two cells sharing a box with the same value even in different rows/cols", () => {
    const grid = emptyGrid();
    grid[0] = 7; // row 0, col 0, box 0
    grid[10] = 7; // row 1, col 1, box 0
    const conflicts = findConflicts(grid);
    expect(conflicts.has(0)).toBe(true);
    expect(conflicts.has(10)).toBe(true);
  });

  it("does not flag equal values in different rows/cols/boxes", () => {
    const grid = emptyGrid();
    grid[0] = 9; // row 0, box 0
    grid[80] = 9; // row 8, box 8
    expect(findConflicts(grid).size).toBe(0);
  });
});

describe("isGridFull", () => {
  it("is false for an empty grid and true for a fully filled one", () => {
    expect(isGridFull(emptyGrid())).toBe(false);
    expect(isGridFull(gridFromString(KNOWN_SOLUTION))).toBe(true);
  });
});

describe("solve", () => {
  it("solves a known puzzle to its known unique solution", () => {
    const solution = solve(gridFromString(KNOWN_PUZZLE));
    expect(solution).not.toBeNull();
    expect(solution!.join("")).toBe(KNOWN_SOLUTION);
  });

  it("returns null for an unsolvable grid", () => {
    const grid = emptyGrid();
    grid[0] = 5;
    grid[1] = 5; // immediate row conflict, no valid fill exists
    expect(solve(grid)).toBeNull();
  });
});

describe("countSolutions", () => {
  it("finds exactly one solution for a known unique puzzle", () => {
    expect(countSolutions(gridFromString(KNOWN_PUZZLE), 2)).toBe(1);
  });

  it("stops at the limit for a wide-open (many-solution) grid", () => {
    expect(countSolutions(emptyGrid(), 2)).toBe(2);
  });
});

describe("validateCompletion", () => {
  const given = gridFromString(KNOWN_PUZZLE);

  it("is incomplete when the grid still has empty cells", () => {
    expect(validateCompletion(given, given)).toEqual({ complete: false, correct: false });
  });

  it("is complete and correct for the true solution", () => {
    const submitted = gridFromString(KNOWN_SOLUTION);
    expect(validateCompletion(given, submitted)).toEqual({ complete: true, correct: true });
  });

  it("is complete but incorrect when a given clue was overwritten", () => {
    const submitted = gridFromString(KNOWN_SOLUTION);
    const givenIndex = given.findIndex((v) => v !== 0);
    submitted[givenIndex] = (submitted[givenIndex] % 9) + 1; // now disagrees with the given clue
    expect(validateCompletion(given, submitted).correct).toBe(false);
  });

  it("is complete but incorrect when the filled grid has a conflict", () => {
    const submitted = gridFromString(KNOWN_SOLUTION);
    // Introduce a same-row duplicate without touching any given clue cell.
    const editableA = given.findIndex((v) => v === 0);
    const editableB = given.findIndex(
      (v, i) => v === 0 && Math.floor(i / 9) === Math.floor(editableA / 9) && i !== editableA,
    );
    expect(editableB).not.toBe(-1);
    submitted[editableB] = submitted[editableA];
    expect(validateCompletion(given, submitted).correct).toBe(false);
  });
});
