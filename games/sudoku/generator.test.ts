import { describe, expect, it } from "vitest";
import { Difficulty } from "@/database/generated/client/enums";
import { CELL_COUNT, EMPTY } from "./engine";
import { countSolutions, findConflicts, isGridFull, solve } from "./validator";
import { DIFFICULTY_TARGET_CLUES, generatePuzzle, generateSolvedGrid } from "./generator";

describe("generateSolvedGrid", () => {
  it("produces a full, conflict-free grid", () => {
    const grid = generateSolvedGrid();
    expect(grid).toHaveLength(CELL_COUNT);
    expect(isGridFull(grid)).toBe(true);
    expect(findConflicts(grid).size).toBe(0);
  });

  it("produces different grids across calls (randomized)", () => {
    const a = generateSolvedGrid();
    const b = generateSolvedGrid();
    expect(a.join("")).not.toBe(b.join(""));
  });
});

describe.each([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD])(
  "generatePuzzle(%s)",
  (difficulty) => {
    it("has a unique solution matching the returned solution grid", () => {
      const { grid, solution } = generatePuzzle(difficulty);
      expect(countSolutions(grid, 2)).toBe(1);
      expect(solve(grid)?.join("")).toBe(solution.join(""));
    });

    it("preserves every given clue from the solution", () => {
      const { grid, solution } = generatePuzzle(difficulty);
      grid.forEach((value, idx) => {
        if (value !== EMPTY) expect(value).toBe(solution[idx]);
      });
    });

    it("reaches (or nearly reaches) the difficulty's target clue count", () => {
      const { grid, clueCount } = generatePuzzle(difficulty);
      const filled = grid.filter((v) => v !== EMPTY).length;
      expect(filled).toBe(clueCount);
      // Carving can stall a few clues above target if removal attempts run
      // out before hitting it exactly — allow some slack either way.
      expect(clueCount).toBeLessThanOrEqual(DIFFICULTY_TARGET_CLUES[difficulty] + 4);
    });
  },
);
