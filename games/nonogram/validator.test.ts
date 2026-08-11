import { describe, expect, it } from "vitest";
import { FILLED, type NonogramPuzzlePayload } from "./engine";
import { validateCompletion } from "./validator";

describe("validateCompletion", () => {
  const target: NonogramPuzzlePayload = {
    width: 3,
    height: 2,
    rowClues: [[1, 1], [3]],
    colClues: [[2], [1], [2]],
  };

  it("accepts the exact intended solution", () => {
    const submitted = [FILLED, 0, FILLED, FILLED, FILLED, FILLED];
    expect(validateCompletion(target, submitted)).toEqual({ complete: true, correct: true });
  });

  it("rejects a grid whose pattern doesn't match the clues", () => {
    const submitted = [FILLED, FILLED, 0, FILLED, FILLED, FILLED];
    expect(validateCompletion(target, submitted)).toEqual({ complete: false, correct: false });
  });

  it("ignores marked-empty vs undetermined — only fill pattern matters", () => {
    const MARKED_EMPTY = 2;
    const submitted = [FILLED, MARKED_EMPTY, FILLED, FILLED, FILLED, FILLED];
    expect(validateCompletion(target, submitted)).toEqual({ complete: true, correct: true });
  });

  it("accepts any grid satisfying the clues, not just one canonical solution", () => {
    // A puzzle whose clues admit more than one valid fill pattern: a 1x2
    // board with row clues [1],[1] and col clue [2] is satisfied by either
    // cell being filled... actually for a single column [2] requires both
    // filled, so use a genuinely ambiguous 2x2 case instead: row clues
    // [1],[1], col clues [1],[1] — either diagonal satisfies it.
    const ambiguous: NonogramPuzzlePayload = {
      width: 2,
      height: 2,
      rowClues: [[1], [1]],
      colClues: [[1], [1]],
    };
    const diagonalA = [FILLED, 0, 0, FILLED];
    const diagonalB = [0, FILLED, FILLED, 0];
    expect(validateCompletion(ambiguous, diagonalA).correct).toBe(true);
    expect(validateCompletion(ambiguous, diagonalB).correct).toBe(true);
  });

  it("throws on a grid of the wrong size", () => {
    expect(() => validateCompletion(target, [FILLED, 0])).toThrow();
  });
});
