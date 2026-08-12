"use client";

import { useCallback, useMemo } from "react";
import {
  RankedMatchShell,
  type GameChrome,
  type RankedDifficultyOption,
} from "@/components/ranked/RankedMatchShell";
import { useRankedMatch } from "@/components/ranked/useRankedMatch";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import { decodePuzzlePayload, encodeGrid, type NonogramGrid } from "../engine";
import { calculateProgress } from "../progress";
import { NonogramBoard } from "./NonogramBoard";

const DIFFICULTIES: RankedDifficultyOption[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "5×5 grid", tone: "bg-[#e2f1d4] text-[#47752d]" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "10×10 grid", tone: "bg-[#fff0c9] text-[#8a6419]" },
  { value: Difficulty.HARD, label: "Hard", detail: "15×15 grid", tone: "bg-[#fde0db] text-[#9d4134]" },
];

const CHROME: GameChrome = {
  title: "Nonogram arena",
  gameLabel: "Nonograms",
  tagline: "You and your opponent get the same picture. First correct solve wins the match and rating.",
  icon: "▦",
  heroClass: "bg-[#6b5330]",
};

export function NonogramRankedMatch() {
  const controller = useRankedMatch(GameType.NONOGRAM);
  const { match, reportProgress, submit } = controller;
  const payload = match?.payload;

  const puzzle = useMemo(() => (payload ? decodePuzzlePayload(payload) : null), [payload]);

  const handleProgress = useCallback(
    (grid: NonogramGrid) => {
      if (!payload) return;
      reportProgress(calculateProgress(payload, encodeGrid(grid)));
    },
    [payload, reportProgress],
  );

  const handleSubmit = useCallback((grid: NonogramGrid) => submit(encodeGrid(grid)), [submit]);

  return (
    <RankedMatchShell controller={controller} chrome={CHROME} difficulties={DIFFICULTIES}>
      {match && puzzle && (
        <NonogramBoard
          key={match.matchId}
          width={puzzle.width}
          height={puzzle.height}
          rowClues={puzzle.rowClues}
          colClues={puzzle.colClues}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      )}
    </RankedMatchShell>
  );
}
