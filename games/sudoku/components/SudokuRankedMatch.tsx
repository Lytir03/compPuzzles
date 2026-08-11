"use client";

import { useEffect, useRef, useState } from "react";
import { getRealtimeToken } from "@/auth/realtimeToken";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import type { MatchFoundPayload, MatchResultPayload } from "@/realtime/events";
import { createRealtimeSocket, type AppClientSocket } from "@/realtime/client";
import { formatElapsed, gridToString } from "../engine";
import { calculateProgress } from "../progress";
import { SudokuBoard } from "./SudokuBoard";

const DIFFICULTIES: { value: Difficulty; label: string; detail: string; tone: string }[] = [
  { value: Difficulty.EASY, label: "Easy", detail: "Steady sprint", tone: "bg-[#e2f1d4] text-[#47752d]" },
  { value: Difficulty.MEDIUM, label: "Medium", detail: "Tactical race", tone: "bg-[#fff0c9] text-[#8a6419]" },
  { value: Difficulty.HARD, label: "Hard", detail: "Full focus", tone: "bg-[#fde0db] text-[#9d4134]" },
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
    return (
      <div className="flex min-h-[430px] flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute h-full w-full animate-ping rounded-full bg-[var(--brand)]/25" />
          <span className="relative h-7 w-7 rounded-full bg-[var(--brand)] shadow-[0_3px_0_var(--brand-strong)]" />
        </span>
        <div>
          <p className="font-black">Joining the arena…</p>
          <p className="subtle-text mt-1 text-sm font-medium">Connecting to the match server</p>
        </div>
      </div>
    );
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
      <div className="py-8 sm:py-12">
        <section className="game-panel overflow-hidden rounded-3xl">
          <div className="checker-pattern relative overflow-hidden bg-[#344d68] px-6 py-8 text-white sm:px-9">
            <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[var(--gold)] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#513b09]">Ranked</span>
                  <span className="text-xs font-bold text-[#c2dcf2]">1v1 live race</span>
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">Sudoku arena</h1>
                <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-white/70">
                  You and your opponent get the same grid. First correct solve wins the match and rating.
                </p>
              </div>
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#6fa9df] text-3xl text-white shadow-[0_5px_0_#3d73a4]">⚡</span>
            </div>
            <span className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full border-[28px] border-white/5" />
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Find a match</p>
                <h2 className="mt-1 text-lg font-black">Choose your difficulty</h2>
              </div>
              <span className="subtle-text hidden text-xs font-bold sm:block">Skill-based pairing</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map(({ value, label, detail, tone }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => joinQueue(value)}
                  className="soft-button group rounded-2xl p-4 text-left"
                >
                  <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black ${tone}`}>{label}</span>
                  <span className="mt-3 flex items-center justify-between font-black">
                    {detail}
                    <span className="text-[var(--brand-strong)] transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="subtle-text mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-[var(--line)] pt-5 text-xs font-bold">
              <span>✓ Server-verified wins</span>
              <span>✓ Live rival progress</span>
              <span>✓ Rating on the line</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (state.phase === "queued") {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center py-12">
        <div className="game-panel flex w-full max-w-md flex-col items-center rounded-3xl px-6 py-10 text-center">
          <span className="relative grid h-20 w-20 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[5px] border-[var(--surface-muted)] border-t-[var(--brand)]" />
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand-soft)] text-xl">⚡</span>
          </span>
          <p className="eyebrow mt-6">Matchmaking</p>
          <h1 className="mt-2 text-2xl font-black">Finding your rival…</h1>
          <p className="subtle-text mt-2 text-sm font-medium">Looking for the fairest available matchup</p>
          {state.queuedAt && <QueueTimer queuedAt={state.queuedAt} />}
        <button
          type="button"
          onClick={leaveQueue}
            className="soft-button mt-7 rounded-xl px-6 py-3 text-sm font-black"
        >
            Leave queue
        </button>
        </div>
      </div>
    );
  }

  if (state.phase === "countdown" && state.match) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center py-12">
        <p className="eyebrow">Opponent found</p>
        <h1 className="mt-2 text-2xl font-black">Get ready!</h1>
        <div className="mt-8 grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="game-panel rounded-2xl p-4 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#6fa9df] font-black text-white">YOU</span>
            <p className="mt-2 font-black">You</p>
          </div>
          <span className="text-lg font-black text-[var(--coral)]">VS</span>
          <div className="game-panel rounded-2xl p-4 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--coral)] text-lg font-black text-white">
              {state.match.opponentUsername.slice(0, 1).toUpperCase()}
            </span>
            <p className="mt-2 truncate font-black">{state.match.opponentUsername}</p>
          </div>
        </div>
        <p className="mt-8 grid h-24 w-24 place-items-center rounded-full bg-[var(--gold)] text-6xl font-black text-[#513b09] shadow-[0_7px_0_#c28b25] tabular-nums">
          {Math.max(state.secondsLeft, 1)}
        </p>
      </div>
    );
  }

  if (state.phase === "playing" && state.match) {
    return (
      <div className="flex flex-col items-center gap-5 py-5 sm:py-8">
        <div className="game-panel w-full max-w-[34rem] rounded-2xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--coral)] font-black text-white">
                {state.match.opponentUsername.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="subtle-text block text-[10px] font-extrabold uppercase tracking-widest">Rival progress</span>
                <span className="block truncate font-black">{state.match.opponentUsername}</span>
              </span>
            </span>
            <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 font-black tabular-nums">
              {state.opponentPercent}%
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)] p-0.5">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#4b91d1,#75b8ed)] transition-all"
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
    const { outcome, reason, ratingBefore, ratingAfter } = state.result;
    return (
      <div className="py-10 sm:py-16">
        <section className="game-panel mx-auto flex max-w-lg flex-col items-center rounded-3xl px-6 py-10 text-center">
          <span
            className={`grid h-20 w-20 place-items-center rounded-3xl text-4xl shadow-[0_6px_0_rgba(0,0,0,.14)] ${
              outcome === "WIN"
                ? "bg-[var(--gold)]"
                : outcome === "LOSS"
                  ? "bg-red-500/15"
                  : "bg-[#d7e8f7]"
            }`}
          >
            {outcome === "WIN" ? "🏆" : outcome === "LOSS" ? "◆" : "🤝"}
          </span>
          <p className="eyebrow mt-6">Match complete</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {outcome === "WIN" ? "Victory!" : outcome === "LOSS" ? "Good battle" : "It’s a draw"}
          </h1>
        <p className="subtle-text mt-2 text-sm font-medium">
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
            className="game-button mt-7 w-full rounded-xl px-6 py-3 font-black"
        >
            Find another match
        </button>
        </section>
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
    <div className="mt-6 rounded-2xl bg-[var(--surface-muted)] px-8 py-4">
      <p className="subtle-text text-[10px] font-extrabold uppercase tracking-widest">New Sudoku rating</p>
      <p className="mt-1 text-4xl font-black tabular-nums">{displayed}</p>
      <p
        className={`mt-1 text-sm font-black tabular-nums ${
          delta >= 0 ? "text-[var(--brand-strong)]" : "text-red-600"
        }`}
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
  return (
    <div className="mt-5 rounded-xl bg-[var(--surface-muted)] px-4 py-2">
      <p className="subtle-text text-[9px] font-extrabold uppercase tracking-widest">Search time</p>
      <p className="mt-0.5 font-mono text-lg font-black tabular-nums">{formatElapsed(elapsedMs)}</p>
    </div>
  );
}
