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

const DIFFICULTIES: RankedDifficultyOption[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "Steady sprint", tone: "bg-[#e2f1d4] text-[#47752d]" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "Tactical race", tone: "bg-[#fff0c9] text-[#8a6419]" },
  { value: Difficulty.HARD, label: "Hard", detail: "Full focus", tone: "bg-[#fde0db] text-[#9d4134]" },
];

const CHROME: GameChrome = {
  title: "Sudoku arena",
  gameLabel: "Sudoku",
  tagline: "You and your opponent get the same grid. First correct solve wins the match and rating.",
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
    <RankedMatchShell controller={controller} chrome={CHROME} difficulties={DIFFICULTIES}>
      {match && (
        <SudokuBoard
          key={match.matchId}
          initialGrid={match.payload}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      )}
    </RankedMatchShell>
  );
}
