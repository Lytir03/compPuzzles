import { describe, expect, it } from "vitest";
import { BLACK } from "./engine";
import { validateCompletion } from "./validator";

describe("validateCompletion", () => {
  const solution = ["C", "A", "T", BLACK, "A", "R", "E", "A"];

  it("is incomplete when any open cell is still blank", () => {
    const submitted = ["C", "A", "T", BLACK, "A", "R", "E", ""];
    expect(validateCompletion(solution, submitted)).toEqual({ complete: false, correct: false });
  });

  it("is correct when every open cell matches the solution", () => {
    const submitted = ["C", "A", "T", BLACK, "A", "R", "E", "A"];
    expect(validateCompletion(solution, submitted)).toEqual({ complete: true, correct: true });
  });

  it("is complete but incorrect when a filled letter is wrong", () => {
    const submitted = ["C", "A", "X", BLACK, "A", "R", "E", "A"];
    expect(validateCompletion(solution, submitted)).toEqual({ complete: true, correct: false });
  });

  it("is case-insensitive", () => {
    const submitted = ["c", "a", "t", BLACK, "a", "r", "e", "a"];
    expect(validateCompletion(solution, submitted)).toEqual({ complete: true, correct: true });
  });

  it("throws on a mismatched grid size", () => {
    expect(() => validateCompletion(solution, ["C", "A"])).toThrow();
  });
});
