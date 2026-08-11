import { describe, expect, it } from "vitest";
import { Difficulty } from "@/database/generated/client/enums";
import { deriveClues } from "./engine";
import { DIFFICULTY_DIMENSIONS, generatePuzzle } from "./generator";
import { validateCompletion } from "./validator";

describe.each([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD])(
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
  },
);
