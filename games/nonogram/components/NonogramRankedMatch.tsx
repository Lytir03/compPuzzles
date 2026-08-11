"use client";

import { useEffect, useRef, useState } from "react";
import { getRealtimeToken } from "@/auth/realtimeToken";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import type { MatchFoundPayload, MatchResultPayload } from "@/realtime/events";
import { createRealtimeSocket, type AppClientSocket } from "@/realtime/client";
import { decodePuzzlePayload, encodeGrid, formatElapsed, type NonogramGrid } from "../engine";
import { calculateProgress } from "../progress";
import { NonogramBoard } from "./NonogramBoard";

const DIFFICULTIES: { value: Difficulty; label: string; detail: string }[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "5×5" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "10×10" },
  { value: Difficulty.HARD, label: "Hard", detail: "15×15" },
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

export function NonogramRankedMatch() {
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
    socketRef.current?.emit("queue:join", { gameType: GameType.NONOGRAM, difficulty });
  }

  function leaveQueue() {
    socketRef.current?.emit("queue:leave");
  }

  function handleProgress(grid: NonogramGrid) {
    if (!state.match) return;
    const percent = calculateProgress(state.match.payload, encodeGrid(grid));
    socketRef.current?.emit("match:progress", { matchId: state.match.matchId, percent });
  }

  function handleSubmit(grid: NonogramGrid) {
    if (!state.match) return;
    socketRef.current?.emit("match:submit", {
      matchId: state.match.matchId,
      payload: encodeGrid(grid),
    });
  }

  if (state.phase === "connecting") {
    return <p className="py-16 text-center text-sm">Connecting…</p>;
  }

  if (state.phase === "error") {
    return (
      <div className="py-12">
        <div className="game-panel mx-auto max-w-md rounded-3xl px-6 py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/12 text-2xl text-red-600">!</span>
          <h1 className="mt-4 text-xl font-black">Couldn&apos;t enter the arena</h1>
          <p className="subtle-text mt-2 text-sm font-medium">{state.errorMessage}</p>
        </div>
      </div>
    );
  }

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <h1 className="text-2xl font-bold">Ranked Nonogram</h1>
        <p className="max-w-md text-center text-sm text-black/60 dark:text-white/60">
          You and your opponent get the same picture. First correct solve wins the match and rating.
        </p>
        <div className="flex gap-3">
          {DIFFICULTIES.map(({ value, label, detail }) => (
            <button
              key={value}
              type="button"
              onClick={() => joinQueue(value)}
              className="soft-button rounded-2xl p-4 text-center"
            >
              <span className="block font-black">{label}</span>
              <span className="subtle-text block text-xs font-semibold">{detail}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (state.phase === "queued") {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 py-16">
        <p className="text-lg font-medium">Searching for an opponent…</p>
        {state.queuedAt && <QueueTimer queuedAt={state.queuedAt} />}
        <button
          type="button"
          onClick={leaveQueue}
          className="soft-button rounded-xl px-6 py-3 font-black"
        >
          Leave queue
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
    const { width, height, rowClues, colClues } = decodePuzzlePayload(state.match.payload);
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
        <NonogramBoard
          key={state.match.matchId}
          width={width}
          height={height}
          rowClues={rowClues}
          colClues={colClues}
          onSubmit={handleSubmit}
          onProgress={handleProgress}
        />
      </div>
    );
  }

  if (state.phase === "result" && state.result) {
    const { outcome, reason, ratingBefore, ratingAfter } = state.result;
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
        <RatingChange key={state.result.matchId} before={ratingBefore} after={ratingAfter} />
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

const RATING_ANIMATION_MS = 900;

function RatingChange({ before, after }: { before: number; after: number }) {
  const [displayed, setDisplayed] = useState(before);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / RATING_ANIMATION_MS);
      setDisplayed(Math.round(before + (after - before) * progress));
      if (progress >= 1) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [before, after]);

  const delta = after - before;

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-4xl font-bold tabular-nums">{displayed}</p>
      <p
        className={`text-sm font-semibold tabular-nums ${delta >= 0 ? "text-green-600" : "text-red-600"}`}
      >
        {delta >= 0 ? "+" : ""}
        {delta}
      </p>
    </div>
  );
}

function QueueTimer({ queuedAt }: { queuedAt: number }) {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - queuedAt);
  useEffect(() => {
    const interval = setInterval(() => setElapsedMs(Date.now() - queuedAt), 500);
    return () => clearInterval(interval);
  }, [queuedAt]);
  return <p className="font-mono text-lg tabular-nums">{formatElapsed(elapsedMs)}</p>;
}
