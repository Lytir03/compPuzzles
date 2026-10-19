"use client";

import { useState } from "react";
import { Difficulty } from "@/database/generated/client/enums";
import { formatElapsed } from "@/lib/formatElapsed";
import { generatePuzzle, type GeneratedMinesweeper } from "../generator";
import { MinesweeperBoard } from "./MinesweeperBoard";

const DIFFICULTIES: { value: Difficulty; label: string; detail: string }[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "9×9 · 10 mines" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "16×16 · 40 mines" },
  { value: Difficulty.HARD, label: "Hard", detail: "30×16 · 99 mines" },
];

type State =
  | { status: "idle" }
  | { status: "loading"; difficulty: Difficulty }
  | { status: "error"; message: string }
  | { status: "playing"; difficulty: Difficulty; puzzle: GeneratedMinesweeper }
  | {
      status: "result";
      difficulty: Difficulty;
      puzzle: GeneratedMinesweeper;
      won: boolean;
      elapsedMs: number;
    };

export function MinesweeperPractice() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function start(difficulty: Difficulty) {
    setState({ status: "loading", difficulty });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const puzzle = generatePuzzle(difficulty);
      setState({ status: "playing", difficulty, puzzle });
    } catch {
      setState({ status: "error", message: "Could not generate a logic-solvable board. Choose a level to try again." });
    }
  }

  if (state.status === "idle" || state.status === "loading" || state.status === "error") {
    return (
      <div className="py-8 sm:py-12">
        <section className="game-panel overflow-hidden rounded-3xl">
          <div className="checker-pattern bg-[#355b72] px-6 py-8 text-white sm:px-9">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#c4e0ef]">
                  No-guess training
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Minesweeper practice</h1>
                <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-white/75">
                  Every board is verified solvable from the opening square. Read the clues—never roll the dice.
                </p>
              </div>
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#8fc3de] text-3xl font-black text-[#173d54] shadow-[0_5px_0_#568ba7]">
                ✹
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-black">Choose a minefield</h2>
              <span className="subtle-text text-xs font-bold">No rating at stake</span>
            </div>
            {state.status === "error" && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-700">{state.message}</p>}
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
              <p className="mt-5 animate-pulse text-center text-sm font-bold text-[#467f9d]">
                Verifying a no-guess board…
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (state.status === "playing") {
    return (
      <div className="flex flex-col items-center gap-6 py-6 sm:py-8">
        <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
          <div>
            <p className="eyebrow">Solo practice</p>
            <h1 className="font-black">
              {state.puzzle.width}×{state.puzzle.height} Minesweeper
            </h1>
          </div>
          <span className="rounded-xl bg-[#dcecf4] px-3 py-1.5 text-xs font-extrabold text-[#35657e]">
            No guessing
          </span>
        </div>
        <MinesweeperBoard
          key={`${state.puzzle.seed}-${state.difficulty}`}
          {...state.puzzle}
          onFinish={(won, elapsedMs) =>
            setState({ ...state, status: "result", won, elapsedMs })
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
            state.won ? "bg-[var(--gold)]" : "bg-[#ffd8d3]"
          }`}
        >
          {state.won ? "🏆" : "✹"}
        </span>
        <p className="eyebrow mt-6">Practice complete</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          {state.won ? "Minefield cleared!" : "Boom. That one was a mine."}
        </h1>
        <div className="mt-4 rounded-2xl bg-[var(--surface-muted)] px-5 py-3">
          <p className="subtle-text text-[10px] font-extrabold uppercase tracking-widest">Time</p>
          <p className="mt-1 font-mono text-2xl font-black tabular-nums">
            {formatElapsed(state.elapsedMs)}
          </p>
        </div>
        <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
          {!state.won && (
            <button
              type="button"
              onClick={() => setState({ status: "playing", difficulty: state.difficulty, puzzle: state.puzzle })}
              className="soft-button flex-1 rounded-xl px-5 py-3 font-black"
            >
              Retry board
            </button>
          )}
          <button
            type="button"
            onClick={() => start(state.difficulty)}
            className="game-button flex-1 rounded-xl px-5 py-3 font-black"
          >
            New board
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            className="soft-button flex-1 rounded-xl px-5 py-3 font-black"
          >
            Change size
          </button>
        </div>
      </section>
    </div>
  );
}
