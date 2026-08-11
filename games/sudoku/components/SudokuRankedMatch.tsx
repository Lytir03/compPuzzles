"use client";

import { useEffect, useRef, useState } from "react";
import { getRealtimeToken } from "@/auth/realtimeToken";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import type { MatchFoundPayload, MatchResultPayload } from "@/realtime/events";
import { createRealtimeSocket, type AppClientSocket } from "@/realtime/client";
import { formatElapsed, gridToString } from "../engine";
import { calculateProgress } from "../progress";
import { SudokuBoard } from "./SudokuBoard";

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: Difficulty.EASY, label: "Easy" },
  { value: Difficulty.MEDIUM, label: "Medium" },
  { value: Difficulty.HARD, label: "Hard" },
];

type Phase = "connecting" | "error" | "idle" | "queued" | "countdown" | "playing" | "result";

interface State {
  phase: Phase;
  errorMessage: string;
  queuedAt: number | null;
  match: MatchFoundPayload | null;
  secondsLeft: number;
  opponentPercent: number;
  result: MatchResultPayload | null;
}

const INITIAL_STATE: State = {
  phase: "connecting",
  errorMessage: "",
  queuedAt: null,
  match: null,
  secondsLeft: 0,
  opponentPercent: 0,
  result: null,
};

export function SudokuRankedMatch() {
  const socketRef = useRef<AppClientSocket | null>(null);
  const [state, setState] = useState<State>(INITIAL_STATE);
  const patch = (changes: Partial<State>) => setState((prev) => ({ ...prev, ...changes }));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getRealtimeToken();
      if (cancelled) return;
      if (!token) {
        patch({ phase: "error", errorMessage: "Not signed in." });
        return;
      }

      const socket = createRealtimeSocket(token);
      socketRef.current = socket;

      socket.on("connect", () => patch({ phase: "idle" }));
      socket.on("connect_error", () =>
        patch({ phase: "error", errorMessage: "Couldn't connect to the match server." }),
      );
      socket.on("queue:joined", ({ queuedAt }) => patch({ phase: "queued", queuedAt }));
      socket.on("queue:left", () => patch({ phase: "idle", queuedAt: null }));
      socket.on("queue:error", ({ message }) => patch({ phase: "error", errorMessage: message }));
      socket.on("match:found", (match) =>
        patch({
          phase: "countdown",
          match,
          secondsLeft: Math.max(0, Math.ceil((match.startsAt - Date.now()) / 1000)),
        }),
      );
      socket.on("match:resume", (match) => patch({ phase: "playing", match, opponentPercent: 0 }));
      socket.on("match:opponentProgress", ({ percent }) => patch({ opponentPercent: percent }));
      socket.on("match:result", (result) => patch({ phase: "result", result }));
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Countdown ticker — separate effect so it only (re)starts when a new match arrives.
  useEffect(() => {
    if (state.phase !== "countdown" || !state.match) return;
    const match = state.match;
    const interval = setInterval(() => {
      const secondsLeft = Math.ceil((match.startsAt - Date.now()) / 1000);
      if (secondsLeft <= 0) {
        patch({ phase: "playing", opponentPercent: 0 });
      } else {
        patch({ secondsLeft });
      }
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === "countdown" ? state.match?.matchId : null]);

  function joinQueue(difficulty: Difficulty) {
    socketRef.current?.emit("queue:join", { gameType: GameType.SUDOKU, difficulty });
  }

  function leaveQueue() {
    socketRef.current?.emit("queue:leave");
  }

  function handleProgress(grid: number[]) {
    if (!state.match) return;
    const percent = calculateProgress(state.match.payload, gridToString(grid));
    socketRef.current?.emit("match:progress", { matchId: state.match.matchId, percent });
  }

  function handleSubmit(grid: number[]) {
    if (!state.match) return;
    socketRef.current?.emit("match:submit", {
      matchId: state.match.matchId,
      payload: gridToString(grid),
    });
  }

  if (state.phase === "connecting") {
    return <p className="py-16 text-center text-sm">Connecting…</p>;
  }

  if (state.phase === "error") {
    return <p className="py-16 text-center text-sm text-red-600">{state.errorMessage}</p>;
  }

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <h1 className="text-2xl font-bold">Ranked Sudoku</h1>
        <p className="max-w-md text-center text-sm text-black/60 dark:text-white/60">
          First to correctly solve the same puzzle wins. Rating isn&apos;t affected yet — that
          arrives in a later phase.
        </p>
        <div className="flex gap-3">
          {DIFFICULTIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => joinQueue(value)}
              className="rounded-lg border border-black/10 px-6 py-3 font-semibold transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (state.phase === "queued") {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <p className="text-lg font-medium">Searching for an opponent…</p>
        {state.queuedAt && <QueueTimer queuedAt={state.queuedAt} />}
        <button
          type="button"
          onClick={leaveQueue}
          className="rounded-lg border border-black/10 px-6 py-3 font-semibold dark:border-white/10"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state.phase === "countdown" && state.match) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-lg">Opponent: {state.match.opponentUsername}</p>
        <p className="text-6xl font-bold tabular-nums">{Math.max(state.secondsLeft, 1)}</p>
      </div>
    );
  }

  if (state.phase === "playing" && state.match) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-sm text-black/60 dark:text-white/60">
            <span>{state.match.opponentUsername}</span>
            <span>{state.opponentPercent}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${state.opponentPercent}%` }}
            />
          </div>
        </div>
        <SudokuBoard
          key={state.match.matchId}
          initialGrid={state.match.payload}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      </div>
    );
  }

  if (state.phase === "result" && state.result) {
    const { outcome, reason } = state.result;
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <h1 className="text-3xl font-bold">
          {outcome === "WIN" ? "You won!" : outcome === "LOSS" ? "You lost" : "Draw"}
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {reason === "abandonment"
            ? outcome === "WIN"
              ? "Your opponent disconnected."
              : "You disconnected too long."
            : "First correct solve wins."}
        </p>
        <button
          type="button"
          onClick={() => setState(INITIAL_STATE)}
          className="rounded-lg bg-foreground px-6 py-3 font-semibold text-background transition hover:opacity-90"
        >
          Queue again
        </button>
      </div>
    );
  }

  return null;
}

function QueueTimer({ queuedAt }: { queuedAt: number }) {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - queuedAt);
  useEffect(() => {
    const interval = setInterval(() => setElapsedMs(Date.now() - queuedAt), 500);
    return () => clearInterval(interval);
  }, [queuedAt]);
  return <p className="font-mono text-lg tabular-nums">{formatElapsed(elapsedMs)}</p>;
}
