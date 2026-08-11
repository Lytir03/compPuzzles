import { describe, expect, it } from "vitest";
import { Difficulty } from "@/database/generated/client/enums";
import { parseCrosswordImport, type CrosswordImportPuzzle } from "./importFormat";

// A 3x3 grid that's also a valid word square (every row and column spells a
// real word), so both directions can be exercised with one small fixture.
function validPuzzle(): CrosswordImportPuzzle {
  return {
    title: "Test Puzzle",
    difficulty: Difficulty.EASY,
    width: 3,
    height: 3,
    grid: ["...", "...", "..."],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, answer: "CAT", clue: "Feline pet" },
        { number: 4, row: 1, col: 0, answer: "ARE", clue: "Form of 'to be'" },
        { number: 5, row: 2, col: 0, answer: "TEN", clue: "One more than nine" },
      ],
      down: [
        { number: 1, row: 0, col: 0, answer: "CAT", clue: "Feline pet, again" },
        { number: 2, row: 0, col: 1, answer: "ARE", clue: "Form of 'to be', again" },
        { number: 3, row: 0, col: 2, answer: "TEN", clue: "One more than nine, again" },
      ],
    },
  };
}

describe("parseCrosswordImport", () => {
  it("parses a valid puzzle and derives the solution grid", () => {
    const parsed = parseCrosswordImport(validPuzzle());
    expect(parsed.solution).toEqual(["C", "A", "T", "A", "R", "E", "T", "E", "N"]);
    expect(parsed.across).toHaveLength(3);
    expect(parsed.down).toHaveLength(3);
  });

  it("strips answers from the derived clue lists (client-safe)", () => {
    const parsed = parseCrosswordImport(validPuzzle());
    for (const clue of [...parsed.across, ...parsed.down]) {
      expect(clue).not.toHaveProperty("answer");
    }
  });

  it("rejects a grid with the wrong dimensions", () => {
    const bad = validPuzzle();
    bad.grid = ["..", ".."];
    expect(() => parseCrosswordImport(bad)).toThrow(/grid must be/);
  });

  it("rejects a grid with invalid characters", () => {
    const bad = validPuzzle();
    bad.grid = ["..X", "...", "..."];
    expect(() => parseCrosswordImport(bad)).toThrow(/'\.'.*'#'/);
  });

  it("rejects an answer of the wrong length", () => {
    const bad = validPuzzle();
    bad.clues.across[0] = { ...bad.clues.across[0], answer: "CATS" };
    expect(() => parseCrosswordImport(bad)).toThrow(/must be 3 letters/);
  });

  it("rejects a clue whose number doesn't match the derived numbering", () => {
    const bad = validPuzzle();
    bad.clues.across[0] = { ...bad.clues.across[0], number: 99 };
    expect(() => parseCrosswordImport(bad)).toThrow(/should be numbered/);
  });

  it("rejects a clue that doesn't start a word given the grid layout", () => {
    const bad = validPuzzle();
    bad.clues.across[0] = { ...bad.clues.across[0], row: 1, col: 1 };
    expect(() => parseCrosswordImport(bad)).toThrow(/no across word starts/);
  });

  it("rejects crossing letters that disagree", () => {
    const bad = validPuzzle();
    bad.clues.down[0] = { ...bad.clues.down[0], answer: "COT" };
    expect(() => parseCrosswordImport(bad)).toThrow(/conflicts with a crossing word/);
  });

  it("rejects a puzzle missing a required clue entry", () => {
    const bad = validPuzzle();
    bad.clues.down = bad.clues.down.slice(0, 2);
    expect(() => parseCrosswordImport(bad)).toThrow(/missing an entry/);
  });
});
