"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RankBadge } from "@/components/RankBadge";
import type { Difficulty } from "@/database/generated/client/enums";
import { formatElapsed } from "@/lib/formatElapsed";
import { getRankTier } from "@/rating/tiers";
import { Confetti } from "./Confetti";
import type { RankedMatchController } from "./useRankedMatch";

/**
 * The non-board chrome of a ranked match — lobby, queue, countdown, live
 * opponent bar, and result — shared by all three games. Each game passes its
 * own board through `children`; everything else here is game-agnostic beyond
 * the labels in `GameChrome`.
 */

export interface RankedDifficultyOption {
  value: Difficulty;
  label: string;
  detail: string;
  tone: string;
}

export interface GameChrome {
  /** e.g. "Sudoku arena" */
  title: string;
  /** e.g. "Sudoku" — used in the rating label on the result screen. */
  gameLabel: string;
  tagline: string;
  icon: string;
  /** Tailwind background class for the lobby hero. */
  heroClass: string;
}

export function RankedMatchShell({
  controller,
  chrome,
  difficulties,
  children,
}: {
  controller: RankedMatchController;
  chrome: GameChrome;
  difficulties: RankedDifficultyOption[];
  children: React.ReactNode;
}) {
  const {
    phase,
    errorMessage,
    queuedAt,
    match,
    secondsLeft,
    opponentPercent,
    result,
    connection,
    opponentConnected,
    opponentGraceMs,
    notice,
    mistakes,
    awaitingVerdict,
    canRetrySubmission,
    retrySubmission,
    lastDifficulty,
    joinQueue,
    leaveQueue,
    playAgain,
    playAgainSameDifficulty,
    dismissNotice,
  } = controller;

  if (phase === "connecting") {
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

  if (phase === "error") {
    return (
      <div className="py-12">
        <div className="game-panel mx-auto max-w-md rounded-3xl px-6 py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/12 text-2xl text-red-600">
            !
          </span>
          <h1 className="mt-4 text-xl font-black">Couldn&apos;t enter the arena</h1>
          <p className="subtle-text mt-2 text-sm font-medium">{errorMessage}</p>
          <button type="button" onClick={() => window.location.reload()} className="game-button mt-5 rounded-xl px-5 py-3 font-black">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConnectionBanner connection={connection} />
      <Notice message={notice} onDismiss={dismissNotice} />

      {phase === "idle" && (
        <div className="py-8 sm:py-12">
          <section className="game-panel overflow-hidden rounded-3xl">
            <div className={`checker-pattern relative overflow-hidden px-6 py-8 text-white sm:px-9 ${chrome.heroClass}`}>
              <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[var(--gold)] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#513b09]">
                      Ranked
                    </span>
                    <span className="text-xs font-bold text-[#c2dcf2]">1v1 live race</span>
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">{chrome.title}</h1>
                  <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-white/70">
                    {chrome.tagline}
                  </p>
                </div>
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#6fa9df] text-3xl text-white shadow-[0_5px_0_#3d73a4]">
                  {chrome.icon}
                </span>
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
                {difficulties.map(({ value, label, detail, tone }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => joinQueue(value)}
                    disabled={connection !== "online"}
                    className="soft-button group rounded-2xl p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black ${tone}`}>
                      {label}
                    </span>
                    <span className="mt-3 flex items-center justify-between font-black">
                      {detail}
                      <span className="text-[var(--brand-text)] transition-transform group-hover:translate-x-1">
                        →
                      </span>
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
      )}

      {phase === "queued" && (
        <div className="flex min-h-[500px] flex-col items-center justify-center py-12">
          <div className="game-panel flex w-full max-w-md flex-col items-center rounded-3xl px-6 py-10 text-center">
            <span className="relative grid h-20 w-20 place-items-center">
              <span className="absolute inset-0 animate-spin rounded-full border-[5px] border-[var(--surface-muted)] border-t-[var(--brand)]" />
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand-soft)] text-xl">
                {chrome.icon}
              </span>
            </span>
            <p className="eyebrow mt-6">Matchmaking</p>
            <h1 className="mt-2 text-2xl font-black">Finding your rival…</h1>
            <p className="subtle-text mt-2 text-sm font-medium">
              {queuedAt ? "Looking for the fairest available matchup" : "Joining the queue…"}
            </p>
            {queuedAt && <QueueTimer queuedAt={queuedAt} />}
            <button
              type="button"
              onClick={leaveQueue}
              className="soft-button mt-7 rounded-xl px-6 py-3 text-sm font-black"
            >
              Leave queue
            </button>
          </div>
        </div>
      )}

      {phase === "countdown" && match && (
        <div className="flex min-h-[500px] flex-col items-center justify-center py-12">
          <p className="eyebrow">Opponent found</p>
          <h1 className="mt-2 text-2xl font-black">Get ready!</h1>
          <div className="mt-8 grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="game-panel rounded-2xl p-4 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#6fa9df] font-black text-white">
                YOU
              </span>
              <p className="mt-2 font-black">You</p>
            </div>
            <span className="text-lg font-black text-[var(--coral)]">VS</span>
            <div className="game-panel rounded-2xl p-4 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--coral)] text-lg font-black text-white">
                {match.opponentUsername.slice(0, 1).toUpperCase()}
              </span>
              <p className="mt-2 truncate font-black">{match.opponentUsername}</p>
            </div>
          </div>
          <p className="mt-8 grid h-24 w-24 place-items-center rounded-full bg-[var(--gold)] text-6xl font-black tabular-nums text-[#513b09] shadow-[0_7px_0_#c28b25]">
            {Math.max(secondsLeft, 1)}
          </p>
        </div>
      )}

      {phase === "playing" && match && (
        <div className="flex flex-col items-center gap-5 py-5 sm:py-8">
          <div className="game-panel w-full max-w-[34rem] rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--coral)] font-black text-white">
                  {match.opponentUsername.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="subtle-text block text-[10px] font-extrabold uppercase tracking-widest">
                    Rival progress
                  </span>
                  <span className="block truncate font-black">{match.opponentUsername}</span>
                </span>
              </span>
              <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 font-black tabular-nums">
                {opponentPercent}%
              </span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)] p-0.5">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#4b91d1,#75b8ed)] transition-all"
                style={{ width: `${opponentPercent}%` }}
              />
            </div>
            {!opponentConnected && (
              <p className="mt-3 rounded-xl bg-[var(--gold)]/20 px-3 py-2 text-xs font-bold text-[#8a6419]">
                {match.opponentUsername} disconnected
                {opponentGraceMs ? ` — they have ${Math.round(opponentGraceMs / 1000)}s to return` : ""}
                . If they don&apos;t come back, you win.
              </p>
            )}
            {mistakes > 0 && (
              <p className="subtle-text mt-3 text-xs font-bold">
                {mistakes} rejected {mistakes === 1 ? "submission" : "submissions"} · breaks a tie in your
                opponent&apos;s favour
              </p>
            )}
          </div>

          {awaitingVerdict && (
            <p className="subtle-text animate-pulse text-sm font-bold">Checking your solution…</p>
          )}
          {canRetrySubmission && !awaitingVerdict && (
            <button type="button" onClick={retrySubmission} disabled={connection !== "online"} className="soft-button rounded-xl px-4 py-2 font-bold disabled:opacity-50">
              Retry solution check
            </button>
          )}

          {children}
        </div>
      )}

      {phase === "result" && result && (
        <ResultScreen
          result={result}
          gameLabel={chrome.gameLabel}
          mistakes={mistakes}
          lastDifficulty={lastDifficulty}
          difficulties={difficulties}
          canRequeue={connection === "online"}
          onPlayAgainSame={playAgainSameDifficulty}
          onChangeDifficulty={playAgain}
        />
      )}
    </>
  );
}

function ConnectionBanner({ connection }: { connection: RankedMatchController["connection"] }) {
  if (connection === "online" || connection === "connecting") return null;

  const reconnecting = connection === "reconnecting";
  return (
    <div
      role="status"
      className={`sticky top-16 z-40 mx-auto mt-3 flex w-full max-w-lg items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold ${
        reconnecting ? "bg-[var(--gold)]/25 text-[#7d5a12]" : "bg-red-500/15 text-red-700"
      }`}
    >
      {reconnecting && (
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      <span>
        {reconnecting
          ? "Connection lost — reconnecting. Your match is held for you."
          : "Disconnected from the match server."}
      </span>
    </div>
  );
}

function Notice({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  // Auto-dismiss so a transient message doesn't linger over the board.
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="mx-auto mt-3 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-bold"
    >
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="subtle-text shrink-0 px-1">
        ✕
      </button>
    </div>
  );
}

function ResultScreen({
  result,
  gameLabel,
  mistakes,
  lastDifficulty,
  difficulties,
  canRequeue,
  onPlayAgainSame,
  onChangeDifficulty,
}: {
  result: NonNullable<RankedMatchController["result"]>;
  gameLabel: string;
  mistakes: number;
  lastDifficulty: Difficulty | null;
  difficulties: RankedDifficultyOption[];
  canRequeue: boolean;
  onPlayAgainSame: () => void;
  onChangeDifficulty: () => void;
}) {
  const { outcome, reason, ratingBefore, ratingAfter, completionTimeMs, opponentCompletionTimeMs } =
    result;
  const tierBefore = getRankTier(ratingBefore).name;
  const tierAfter = getRankTier(ratingAfter).name;
  const difficultyLabel = difficulties.find((d) => d.value === lastDifficulty)?.label;

  const promoted = tierAfter !== tierBefore && ratingAfter > ratingBefore;

  return (
    <div className="py-10 sm:py-16">
      {outcome === "WIN" && <Confetti key={result.matchId} seed={result.matchId} />}
      {/* `result-rise` gives the verdict an entrance — the board is swapped out
          in a single frame otherwise, which reads as a glitch. */}
      <section className="game-panel result-rise mx-auto flex max-w-lg flex-col items-center rounded-3xl px-6 py-10 text-center">
        <span
          className={`badge-pop grid h-20 w-20 place-items-center rounded-3xl text-4xl shadow-[0_6px_0_rgba(0,0,0,.14)] ${
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

        <RatingChange
          key={result.matchId}
          before={ratingBefore}
          after={ratingAfter}
          gameLabel={gameLabel}
        />

        {tierAfter !== tierBefore && (
          <p
            className={`mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${
              promoted ? "bg-[var(--brand-soft)] text-[var(--brand-text)]" : ""
            }`}
          >
            {promoted ? `Promoted out of ${tierBefore} —` : `Dropped to`}{" "}
            {/* The badge lands after the rating count-up rather than with it,
                so a promotion registers as its own beat. */}
            <span
              className="badge-pop inline-flex"
              style={{ animationDelay: `${RATING_ANIMATION_MS}ms` }}
            >
              <RankBadge rating={ratingAfter} />
            </span>
          </p>
        )}

        <dl className="mt-6 grid w-full grid-cols-2 gap-2 text-sm">
          <SolveTime label="Your time" ms={completionTimeMs} />
          <SolveTime label={result.opponentUsername} ms={opponentCompletionTimeMs} />
        </dl>
        {mistakes > 0 && (
          <p className="subtle-text mt-3 text-xs font-bold">
            {mistakes} rejected {mistakes === 1 ? "submission" : "submissions"} this match
          </p>
        )}

        <button
          type="button"
          onClick={onPlayAgainSame}
          disabled={!canRequeue}
          className="game-button mt-7 w-full rounded-xl px-6 py-3.5 text-base font-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {difficultyLabel ? `Play again — ${difficultyLabel}` : "Play again"}
        </button>
        <button
          type="button"
          onClick={onChangeDifficulty}
          className="mt-3 text-sm font-bold text-[var(--brand-text)] hover:underline"
        >
          Change difficulty
        </button>

        {/* The result screen used to dead-end at requeue — no way to inspect
            the match or look up who just beat you. */}
        <div className="subtle-text mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold">
          <Link href={`/matches/${result.matchId}`} className="hover:underline">
            Match details
          </Link>
          <Link
            href={`/profile/${encodeURIComponent(result.opponentUsername)}`}
            className="hover:underline"
          >
            {result.opponentUsername}’s profile
          </Link>
          <Link href="/matches" className="hover:underline">
            Match history
          </Link>
        </div>
      </section>
    </div>
  );
}

function SolveTime({ label, ms }: { label: string; ms: number | null }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
      <dt className="subtle-text truncate text-[10px] font-extrabold uppercase tracking-widest">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg font-black tabular-nums">
        {ms === null ? "—" : formatElapsed(ms)}
      </dd>
    </div>
  );
}

const RATING_ANIMATION_MS = 900;

function RatingChange({
  before,
  after,
  gameLabel,
}: {
  before: number;
  after: number;
  gameLabel: string;
}) {
  const [displayed, setDisplayed] = useState(before);

  useEffect(() => {
    // Respect the same reduced-motion preference the CSS honours — CSS can't
    // reach a JS-driven count-up.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Zero duration lands on the final value in the first frame rather than
    // animating — same code path, no count-up.
    const durationMs = reduceMotion ? 0 : RATING_ANIMATION_MS;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = durationMs === 0 ? 1 : Math.min(1, (now - start) / durationMs);
      setDisplayed(Math.round(before + (after - before) * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [before, after]);

  const delta = after - before;

  return (
    <div className="mt-6 rounded-2xl bg-[var(--surface-muted)] px-8 py-4">
      <p className="subtle-text text-[10px] font-extrabold uppercase tracking-widest">
        New {gameLabel} rating
      </p>
      <p className="mt-1 text-4xl font-black tabular-nums">{displayed}</p>
      <p
        className={`mt-1 text-sm font-black tabular-nums ${
          delta >= 0 ? "text-[var(--brand-text)]" : "text-red-600"
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
