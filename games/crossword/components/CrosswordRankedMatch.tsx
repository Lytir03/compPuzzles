"use client";

import { useCallback, useMemo } from "react";
import {
  RankedMatchShell,
  type GameChrome,
  type RankedDifficultyOption,
} from "@/components/ranked/RankedMatchShell";
import { useRankedMatch } from "@/components/ranked/useRankedMatch";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import { decodePuzzlePayload, encodeGrid, type CrosswordGrid } from "../engine";
import { calculateProgress } from "../progress";
import { CrosswordBoard } from "./CrosswordBoard";

const DIFFICULTIES: RankedDifficultyOption[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "Short, simple words", tone: "bg-[#e2f1d4] text-[#47752d]" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "Standard mini", tone: "bg-[#fff0c9] text-[#8a6419]" },
  { value: Difficulty.HARD, label: "Hard", detail: "Denser, trickier clues", tone: "bg-[#fde0db] text-[#9d4134]" },
];

const CHROME: GameChrome = {
  title: "Crossword arena",
  gameLabel: "Crosswords",
  tagline: "You and your opponent get the same grid. First correct solve wins the match and rating.",
  icon: "A",
  heroClass: "bg-[#3f5a7a]",
};

export function CrosswordRankedMatch() {
  const controller = useRankedMatch(GameType.CROSSWORD);
  const { match, reportProgress, submit } = controller;
  const payload = match?.payload;

  const puzzle = useMemo(() => (payload ? decodePuzzlePayload(payload) : null), [payload]);

  const handleProgress = useCallback(
    (grid: CrosswordGrid) => {
      if (!payload) return;
      reportProgress(calculateProgress(payload, encodeGrid(grid)));
    },
    [payload, reportProgress],
  );

  const handleSubmit = useCallback((grid: CrosswordGrid) => submit(encodeGrid(grid)), [submit]);

  return (
    <RankedMatchShell controller={controller} chrome={CHROME} difficulties={DIFFICULTIES}>
      {match && puzzle && (
        <CrosswordBoard
          key={match.matchId}
          title={puzzle.title}
          width={puzzle.width}
          height={puzzle.height}
          mask={puzzle.mask}
          across={puzzle.across}
          down={puzzle.down}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      )}
    </RankedMatchShell>
  );
}
