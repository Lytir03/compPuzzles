"use client";

import { useState } from "react";
import { startPracticePuzzle, submitPracticeSolution } from "../actions";
import { Difficulty } from "@/database/generated/client/enums";
import { formatElapsed, gridToString } from "../engine";
import { SudokuBoard } from "./SudokuBoard";

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: Difficulty.EASY, label: "Easy" },
  { value: Difficulty.MEDIUM, label: "Medium" },
  { value: Difficulty.HARD, label: "Hard" },
];

type State =
  | { status: "idle" }
  | { status: "loading"; difficulty: Difficulty }
  | { status: "error"; difficulty: Difficulty; message: string }
  | { status: "playing"; difficulty: Difficulty; puzzleId: string; grid: string }
  | { status: "submitting"; difficulty: Difficulty; puzzleId: string; grid: string }
  | {
      status: "result";
      difficulty: Difficulty;
      correct: boolean;
      elapsedMs: number;
    };

export function SudokuPractice() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function start(difficulty: Difficulty) {
    setState({ status: "loading", difficulty });
    try {
      const puzzle = await startPracticePuzzle(difficulty);
      setState({ status: "playing", difficulty, puzzleId: puzzle.puzzleId, grid: puzzle.grid });
    } catch (error) {
      setState({
        status: "error",
        difficulty,
        message: error instanceof Error ? error.message : "Could not start a puzzle.",
      });
    }
  }

  async function handleSubmit(difficulty: Difficulty, puzzleId: string, grid: number[], elapsedMs: number) {
    setState({ status: "submitting", difficulty, puzzleId, grid: gridToString(grid) });
    const result = await submitPracticeSolution(puzzleId, gridToString(grid), elapsedMs);
    setState({ status: "result", difficulty, correct: result.correct, elapsedMs });
  }

  if (state.status === "idle" || state.status === "loading" || state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <h1 className="text-2xl font-bold">Sudoku practice</h1>
        <p className="max-w-md text-center text-sm text-black/60 dark:text-white/60">
          Solo, untimed-pressure practice — no rating on the line. Ranked matches arrive in a
          later phase.
        </p>
        <div className="flex gap-3">
          {DIFFICULTIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={state.status === "loading"}
              onClick={() => start(value)}
              className="rounded-lg border border-black/10 px-6 py-3 font-semibold transition hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
            >
              {label}
            </button>
          ))}
        </div>
        {state.status === "loading" && <p className="text-sm">Loading puzzle…</p>}
        {state.status === "error" && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}
      </div>
    );
  }

  if (state.status === "playing" || state.status === "submitting") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <SudokuBoard
          key={state.puzzleId}
          initialGrid={state.grid}
          disabled={state.status === "submitting"}
          onSubmit={(grid, elapsedMs) => handleSubmit(state.difficulty, state.puzzleId, grid, elapsedMs)}
        />
      </div>
    );
  }

  // state.status === "result"
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <h1 className="text-3xl font-bold">{state.correct ? "Solved!" : "Not quite"}</h1>
      {state.correct && (
        <p className="font-mono text-lg tabular-nums">{formatElapsed(state.elapsedMs)}</p>
      )}
      {!state.correct && (
        <p className="max-w-md text-center text-sm text-black/60 dark:text-white/60">
          The server didn&apos;t confirm that grid as correct. This shouldn&apos;t happen from
          normal play — try again.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => start(state.difficulty)}
          className="rounded-lg bg-foreground px-6 py-3 font-semibold text-background transition hover:opacity-90"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={() => setState({ status: "idle" })}
          className="rounded-lg border border-black/10 px-6 py-3 font-semibold dark:border-white/10"
        >
          Change difficulty
        </button>
      </div>
    </div>
  );
}
