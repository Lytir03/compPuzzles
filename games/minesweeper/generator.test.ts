import { describe, expect, it } from "vitest";
import { Difficulty } from "@/database/generated/client/enums";
import { adjacentMineCount } from "./engine";
import { DIFFICULTY_CONFIG, generatePuzzle } from "./generator";
import { solveMinesweeperLogically } from "./solver";

describe.each([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD])(
  "generatePuzzle(%s)",
  (difficulty) => {
    it("creates a reproducible, no-guess board", () => {
      const seed = 0xc0ffee;
      const puzzle = generatePuzzle(difficulty, seed);
      const repeated = generatePuzzle(difficulty, seed);

      expect(puzzle).toEqual(repeated);
      expect(puzzle.mines).toHaveLength(puzzle.width * puzzle.height);
      expect(puzzle.mines.filter(Boolean)).toHaveLength(DIFFICULTY_CONFIG[difficulty].mineCount);
      expect(puzzle.mines[puzzle.openingCell]).toBe(false);
      expect(adjacentMineCount(puzzle.mines, puzzle, puzzle.openingCell)).toBe(0);

      const solved = solveMinesweeperLogically(
        puzzle.mines,
        puzzle,
        puzzle.mineCount,
        puzzle.openingCell,
      );
      expect(solved.status).toBe("solved");
    });
  },
);
