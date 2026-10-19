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
  { value: Difficulty.EASY, label: "Quick 5×5", detail: "Compact logic race", tone: "bg-[#e2f1d4] text-[#47752d]" },
  { value: Difficulty.MEDIUM, label: "Classic 10×10", detail: "Longer picture race", tone: "bg-[#fff0c9] text-[#8a6419]" },
];

const CHROME: GameChrome = {
  title: "Nonogram arena",
  gameLabel: "Nonograms",
  tagline: "Two clear, uniquely solvable sizes. You and your opponent race the same picture.",
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
          disabled={controller.awaitingVerdict}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      )}
    </RankedMatchShell>
  );
}
