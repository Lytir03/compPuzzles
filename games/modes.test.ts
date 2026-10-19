import { describe, expect, it } from "vitest";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import {
  getRankedMode,
  PRACTICE_MODE_IDS,
  RANKED_MODE_IDS,
  rankedModeIdFor,
} from "./modes";

describe("ranked mode whitelist", () => {
  it("contains exactly the five launch modes", () => {
    expect(RANKED_MODE_IDS).toEqual([
      "SUDOKU_6X6_CHALLENGE",
      "SUDOKU_9X9_EASY",
      "SUDOKU_9X9_HARD",
      "NONOGRAM_5X5",
      "NONOGRAM_10X10",
    ]);
  });

  it("maps every mode both ways", () => {
    for (const modeId of RANKED_MODE_IDS) {
      const mode = getRankedMode(modeId);
      expect(rankedModeIdFor(mode.gameType, mode.difficulty)).toBe(modeId);
    }
  });

  it("never maps Crossword or hard Nonogram into ranked", () => {
    expect(rankedModeIdFor(GameType.CROSSWORD, Difficulty.EASY)).toBeNull();
    expect(rankedModeIdFor(GameType.NONOGRAM, Difficulty.HARD)).toBeNull();
  });

  it("advertises the requested practice-only Minesweeper sizes", () => {
    expect(PRACTICE_MODE_IDS).toEqual(expect.arrayContaining([
      "MINESWEEPER_9X9_10",
      "MINESWEEPER_16X16_40",
      "MINESWEEPER_30X16_99",
    ]));
  });
});
