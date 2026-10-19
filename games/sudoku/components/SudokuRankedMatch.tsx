"use client";

import { useCallback } from "react";
import {
  RankedMatchShell,
  type GameChrome,
  type RankedDifficultyOption,
} from "@/components/ranked/RankedMatchShell";
import { useRankedMatch } from "@/components/ranked/useRankedMatch";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import { gridToString } from "../engine";
import { calculateProgress } from "../progress";
import { SudokuBoard } from "./SudokuBoard";

export const SUDOKU_RANKED_DIFFICULTIES: RankedDifficultyOption[] = [
  {
    value: Difficulty.EASY,
    label: "6×6 Challenge",
    detail: "Fewer clues · fast, not easy",
    tone: "bg-[#dcecf4] text-[#35657e]",
  },
  {
    value: Difficulty.MEDIUM,
    label: "Easy 9×9",
    detail: "Classic grid · more clues",
    tone: "bg-[#fff0c9] text-[#8a6419]",
  },
  {
    value: Difficulty.HARD,
    label: "Hard 9×9",
    detail: "Sparse clues · full focus",
    tone: "bg-[#fde0db] text-[#9d4134]",
  },
];

export const SUDOKU_RANKED_CHROME: GameChrome = {
  title: "Sudoku arena",
  gameLabel: "Sudoku",
  tagline: "Race a challenging 6×6, an easy 9×9, or a hard 9×9. First correct solve wins.",
  icon: "⚡",
  heroClass: "bg-[#344d68]",
};

export function SudokuRankedMatch() {
  const controller = useRankedMatch(GameType.SUDOKU);
  const { match, reportProgress, submit } = controller;
  const payload = match?.payload;

  const handleProgress = useCallback(
    (grid: number[]) => {
      if (!payload) return;
      reportProgress(calculateProgress(payload, gridToString(grid)));
    },
    [payload, reportProgress],
  );

  const handleSubmit = useCallback((grid: number[]) => submit(gridToString(grid)), [submit]);

  return (
    <RankedMatchShell
      controller={controller}
      chrome={SUDOKU_RANKED_CHROME}
      difficulties={SUDOKU_RANKED_DIFFICULTIES}
    >
      {match && (
        <SudokuBoard
          key={match.matchId}
          initialGrid={match.payload}
          disabled={controller.awaitingVerdict}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      )}
    </RankedMatchShell>
  );
}
