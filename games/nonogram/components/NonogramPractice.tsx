"use client";

import { useState } from "react";
import { Difficulty } from "@/database/generated/client/enums";
import { startPracticePuzzle, submitPracticeSolution } from "../actions";
import { decodePuzzlePayload, encodeGrid, formatElapsed, type NonogramGrid } from "../engine";
import { NonogramBoard } from "./NonogramBoard";

const DIFFICULTIES: { value: Difficulty; label: string; detail: string }[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "5×5 warm-up" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "10×10 challenge" },
  { value: Difficulty.HARD, label: "Hard", detail: "15×15 marathon" },
];

type State =
  | { status: "idle" }
  | { status: "loading"; difficulty: Difficulty }
  | { status: "error"; difficulty: Difficulty; message: string }
  | { status: "playing"; difficulty: Difficulty; puzzleId: string; payload: string }
  | { status: "submitting"; difficulty: Difficulty; puzzleId: string; payload: string }
  | { status: "result"; difficulty: Difficulty; correct: boolean; elapsedMs: number };

export function NonogramPractice() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function start(difficulty: Difficulty) {
    setState({ status: "loading", difficulty });
    try {
      const puzzle = await startPracticePuzzle(difficulty);
      setState({ status: "playing", difficulty, puzzleId: puzzle.puzzleId, payload: puzzle.payload });
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
    grid: NonogramGrid,
    elapsedMs: number,
  ) {
    setState({ status: "submitting", difficulty, puzzleId, payload: encodeGrid(grid) });
    const result = await submitPracticeSolution(puzzleId, encodeGrid(grid), elapsedMs);
    setState({ status: "result", difficulty, correct: result.correct, elapsedMs });
  }

  if (state.status === "idle" || state.status === "loading" || state.status === "error") {
    return (
      <div className="py-8 sm:py-12">
        <section className="game-panel overflow-hidden rounded-3xl">
          <div className="checker-pattern bg-[#a3781f] px-6 py-8 text-white sm:px-9">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f6e2b3]">
                  Training room
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Nonogram practice</h1>
                <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-white/70">
                  Fill in the picture using the row and column clues. No rating at stake.
                </p>
              </div>
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#f4c45f] text-3xl font-black text-[#543c08] shadow-[0_5px_0_#c48c29]">
                ▦
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-black">Choose a size</h2>
              <span className="subtle-text text-xs font-bold">No rating at stake</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map(({ value, label, detail }) => (
                <button
                  key={value}
                  type="button"
                  disabled={state.status === "loading"}
                  onClick={() => start(value)}
                  className="soft-button rounded-2xl p-4 text-left disabled:opacity-50"
                >
                  <span className="block font-black">{label}</span>
                  <span className="subtle-text block text-xs font-semibold">{detail}</span>
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
    const { width, height, rowClues, colClues } = decodePuzzlePayload(state.payload);
    return (
      <div className="flex flex-col items-center gap-6 py-6 sm:py-8">
        <div className="flex w-full max-w-[34rem] items-center justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
          <div>
            <p className="eyebrow">Solo practice</p>
            <h1 className="font-black">
              {width}×{height} Nonogram
            </h1>
          </div>
          <span className="rounded-xl bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
            No rating
          </span>
        </div>
        <NonogramBoard
          key={state.puzzleId}
          width={width}
          height={height}
          rowClues={rowClues}
          colClues={colClues}
          disabled={state.status === "submitting"}
          onSubmit={(grid, elapsedMs) => handleSubmit(state.difficulty, state.puzzleId, grid, elapsedMs)}
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
          {state.correct ? "Picture solved!" : "Not quite"}
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
            Change size
          </button>
        </div>
      </section>
    </div>
  );
}
