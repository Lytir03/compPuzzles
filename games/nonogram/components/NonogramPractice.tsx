"use client";

import { useRef, useState } from "react";
import { Difficulty } from "@/database/generated/client/enums";
import { startPracticePuzzle, submitPracticeSolution } from "../actions";
import { decodePuzzlePayload, encodeGrid, formatElapsed, type NonogramGrid } from "../engine";
import { NonogramBoard } from "./NonogramBoard";

const DIFFICULTIES: { value: Difficulty; label: string; detail: string }[] = [
  { value: Difficulty.EASY, label: "Quick 5×5", detail: "Small, readable warm-up" },
  { value: Difficulty.MEDIUM, label: "Classic 10×10", detail: "Longer logic challenge" },
];

type State =
  | { status: "idle" }
  | { status: "loading"; difficulty: Difficulty }
  | { status: "error"; difficulty: Difficulty; message: string }
  | { status: "playing"; difficulty: Difficulty; assignmentId: string; payload: string }
  | { status: "submitting"; difficulty: Difficulty; assignmentId: string; payload: string }
  | { status: "submit-error"; difficulty: Difficulty; assignmentId: string; payload: string; message: string }
  | { status: "result"; difficulty: Difficulty; correct: boolean; elapsedMs: number };

export function NonogramPractice() {
  const [state, setState] = useState<State>({ status: "idle" });

  const lastSubmission = useRef<{ grid: number[]; elapsedMs: number } | null>(null);

  async function start(difficulty: Difficulty) {
    lastSubmission.current = null;
    setState({ status: "loading", difficulty });
    try {
      const puzzle = await startPracticePuzzle(difficulty);
      setState({ status: "playing", difficulty, assignmentId: puzzle.assignmentId, payload: puzzle.payload });
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
    assignmentId: string,
    grid: NonogramGrid,
    elapsedMs: number,
  ) {
    lastSubmission.current = { grid: [...grid], elapsedMs };
    // Keep the original givens/clues while the board stays mounted.
    setState((previous) => ("payload" in previous ? { ...previous, status: "submitting" } : previous));
    try {
      const result = await submitPracticeSolution(assignmentId, encodeGrid(grid), elapsedMs);
      setState({ status: "result", difficulty, correct: result.correct, elapsedMs });
    } catch (error) {
      setState((previous) => ("payload" in previous ? {
        ...previous,
        status: "submit-error",
        message: error instanceof Error ? error.message : "Could not check your solution. Try again.",
      } : previous));
    }
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
                  Every grid has one solution and yields to logic alone. No rating at stake.
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
            <div className="grid gap-3 sm:grid-cols-2">
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
              <p className="mt-5 animate-pulse text-center text-sm font-bold text-[var(--brand-text)]">
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

  if (state.status === "playing" || state.status === "submitting" || state.status === "submit-error") {
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
          <span className="rounded-xl bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-text)]">
            Unique · no guessing
          </span>
        </div>
        {state.status === "submit-error" && (
          <div role="alert" className="w-full max-w-lg rounded-xl bg-red-500/10 p-4 text-center text-sm font-bold">
            <p>{state.message}</p>
            <div className="mt-3 flex justify-center gap-3">
              <button type="button" className="soft-button rounded-xl px-4 py-2" onClick={() => {
                const submission = lastSubmission.current;
                if (submission) void handleSubmit(state.difficulty, state.assignmentId, submission.grid, submission.elapsedMs);
              }}>Retry check</button>
              <button type="button" className="soft-button rounded-xl px-4 py-2" onClick={() => start(state.difficulty)}>New puzzle</button>
            </div>
          </div>
        )}
        <NonogramBoard
          key={state.assignmentId}
          width={width}
          height={height}
          rowClues={rowClues}
          colClues={colClues}
          disabled={state.status !== "playing"}
          onSubmit={(grid, elapsedMs) => handleSubmit(state.difficulty, state.assignmentId, grid, elapsedMs)}
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
