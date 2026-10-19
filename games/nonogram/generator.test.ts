import { describe, expect, it } from "vitest";
import { Difficulty } from "@/database/generated/client/enums";
import { deriveClues } from "./engine";
import {
  DIFFICULTY_DIMENSIONS,
  SUPPORTED_NONOGRAM_DIFFICULTIES,
  generatePuzzle,
} from "./generator";
import { solveNonogramLogically } from "./solver";
import { validateCompletion } from "./validator";

describe.each(SUPPORTED_NONOGRAM_DIFFICULTIES)(
  "generatePuzzle(%s)",
  (difficulty) => {
    it("produces a grid matching the expected board size", () => {
      const { dims, solution } = generatePuzzle(difficulty);
      expect(dims).toEqual(DIFFICULTY_DIMENSIONS[difficulty]);
      expect(solution).toHaveLength(dims.width * dims.height);
    });

    it("derives clues that are internally consistent with the solution grid", () => {
      const { dims, solution, rowClues, colClues } = generatePuzzle(difficulty);
      const derived = deriveClues(solution, dims);
      expect(derived.rowClues).toEqual(rowClues);
      expect(derived.colClues).toEqual(colClues);
    });

    it("the solution grid itself passes validateCompletion against the puzzle payload", () => {
      const { dims, solution, rowClues, colClues } = generatePuzzle(difficulty);
      const result = validateCompletion({ ...dims, rowClues, colClues }, solution);
      expect(result).toEqual({ complete: true, correct: true });
    });

    it("is not degenerate (not all-empty or all-filled)", () => {
      const { solution } = generatePuzzle(difficulty);
      const filledCount = solution.filter((cell) => cell === 1).length;
      expect(filledCount).toBeGreaterThan(0);
      expect(filledCount).toBeLessThan(solution.length);
    });

    it("can be completed using forced deductions without guessing", () => {
      const puzzle = generatePuzzle(difficulty);
      const result = solveNonogramLogically({
        ...puzzle.dims,
        rowClues: puzzle.rowClues,
        colClues: puzzle.colClues,
      });

      expect(result.status).toBe("solved");
      expect(result.grid).toEqual(
        puzzle.solution.map((cell) => (cell === 1 ? 1 : 2)),
      );
    });
  },
);

it("keeps the launch offering to 5×5 and 10×10", () => {
  expect(DIFFICULTY_DIMENSIONS).toEqual({
    [Difficulty.EASY]: { width: 5, height: 5 },
    [Difficulty.MEDIUM]: { width: 10, height: 10 },
  });
  expect(() => generatePuzzle(Difficulty.HARD)).toThrow(/Unsupported Nonogram mode/);
});
