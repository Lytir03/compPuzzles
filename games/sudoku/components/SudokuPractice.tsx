"use client";

import { useState } from "react";
import { startPracticePuzzle, submitPracticeSolution } from "../actions";
import { Difficulty } from "@/database/generated/client/enums";
import { formatElapsed, gridToString } from "../engine";
import { SudokuBoard } from "./SudokuBoard";

const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  detail: string;
  tone: string;
  mark: string;
}[] = [
  {
    value: Difficulty.EASY,
    label: "Easy",
    detail: "A calm warm-up",
    tone: "bg-[#e2f1d4] text-[#47752d]",
    mark: "●",
  },
  {
    value: Difficulty.MEDIUM,
    label: "Medium",
    detail: "A proper challenge",
    tone: "bg-[#fff0c9] text-[#8a6419]",
    mark: "◆",
  },
  {
    value: Difficulty.HARD,
    label: "Hard",
    detail: "Bring your best",
    tone: "bg-[#fde0db] text-[#9d4134]",
    mark: "▲",
  },
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

  async function handleSubmit(
    difficulty: Difficulty,
    puzzleId: string,
    grid: number[],
    elapsedMs: number,
  ) {
    setState({ status: "submitting", difficulty, puzzleId, grid: gridToString(grid) });
    const result = await submitPracticeSolution(puzzleId, gridToString(grid), elapsedMs);
    setState({ status: "result", difficulty, correct: result.correct, elapsedMs });
  }

  if (state.status === "idle" || state.status === "loading" || state.status === "error") {
    return (
      <div className="py-8 sm:py-12">
        <section className="game-panel overflow-hidden rounded-3xl">
          <div className="checker-pattern bg-[#416534] px-6 py-8 text-white sm:px-9">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#caeab2]">
                  Training room
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Sudoku practice</h1>
                <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-white/70">
                  Sharpen your solve speed without risking rating. Pick a level and jump straight in.
                </p>
              </div>
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#8dca59] text-3xl font-black text-[#284717] shadow-[0_5px_0_#5a9237]">
                9
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-black">Choose difficulty</h2>
              <span className="subtle-text text-xs font-bold">No rating at stake</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map(({ value, label, detail, tone, mark }) => (
                <button
                  key={value}
                  type="button"
                  disabled={state.status === "loading"}
                  onClick={() => start(value)}
                  className="soft-button flex items-center gap-3 rounded-2xl p-4 text-left disabled:opacity-50"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm ${tone}`}>
                    {mark}
                  </span>
                  <span>
                    <span className="block font-black">{label}</span>
                    <span className="subtle-text block text-xs font-semibold">{detail}</span>
                  </span>
                </button>
              ))}
            </div>
            {state.status === "loading" && (
              <p className="mt-5 animate-pulse text-center text-sm font-bold text-[var(--brand-strong)]">
                Building your puzzle…
              </p>
            )}
            {state.status === "error" && (
              <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-600">
                {state.message}
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (state.status === "playing" || state.status === "submitting") {
    return (
      <div className="flex flex-col items-center gap-6 py-6 sm:py-8">
        <div className="flex w-full max-w-[34rem] items-center justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
          <div>
            <p className="eyebrow">Solo practice</p>
            <h1 className="font-black">
              {state.difficulty.charAt(0) + state.difficulty.slice(1).toLowerCase()} Sudoku
            </h1>
          </div>
          <span className="rounded-xl bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
            No rating
          </span>
        </div>
        <SudokuBoard
          key={state.puzzleId}
          initialGrid={state.grid}
          disabled={state.status === "submitting"}
          onSubmit={(grid, elapsedMs) =>
            handleSubmit(state.difficulty, state.puzzleId, grid, elapsedMs)
          }
        />
      </div>
    );
  }

  return (
    <div className="py-10 sm:py-16">
      <section className="game-panel mx-auto flex max-w-lg flex-col items-center overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10">
        <span
          className={`grid h-20 w-20 place-items-center rounded-3xl text-4xl shadow-[0_6px_0_rgba(0,0,0,.14)] ${
            state.correct ? "bg-[var(--gold)]" : "bg-red-500/15"
          }`}
        >
          {state.correct ? "🏆" : "↻"}
        </span>
        <p className="eyebrow mt-6">Practice complete</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          {state.correct ? "Puzzle crushed!" : "Not quite"}
        </h1>
        {state.correct && (
          <div className="mt-4 rounded-2xl bg-[var(--surface-muted)] px-5 py-3">
            <p className="subtle-text text-[10px] font-extrabold uppercase tracking-widest">Solve time</p>
            <p className="mt-1 font-mono text-2xl font-black tabular-nums">
              {formatElapsed(state.elapsedMs)}
            </p>
          </div>
        )}
        {!state.correct && (
          <p className="subtle-text mt-4 max-w-md text-sm font-medium leading-6">
            The server couldn&apos;t confirm that grid. Give the puzzle another go.
          </p>
        )}
        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => start(state.difficulty)}
            className="game-button flex-1 rounded-xl px-6 py-3 font-black"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            className="soft-button flex-1 rounded-xl px-6 py-3 font-black"
          >
            Change level
          </button>
        </div>
      </section>
    </div>
  );
}
