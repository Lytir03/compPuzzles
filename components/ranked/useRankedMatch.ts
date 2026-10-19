"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRealtimeTicket } from "@/auth/realtimeToken";
import type { Difficulty, GameType } from "@/database/generated/client/enums";
import { rankedModeIdFor } from "@/games/modes";
import type { MatchFoundPayload, MatchResultPayload } from "@/realtime/events";
import { createRealtimeSocket, type AppClientSocket } from "@/realtime/client";
import {
  forgetRankedMatch,
  readRememberedRankedMatch,
  rememberRankedMatch,
} from "./matchSession";
import { reconnectWithFreshTicket } from "./reconnect";

/**
 * All the ranked-match wiring that is identical for Sudoku, Nonogram and
 * Crossword: socket lifecycle, queue/countdown/result phases, reconnect
 * handling, and pending states. Each game supplies only its board and its
 * payload encoding — the three components used to carry ~110 byte-identical
 * lines apiece, which meant every reconnect or loading-state fix was a
 * three-way edit and, in practice, only landed in Sudoku.
 */

export type RankedPhase =
  | "connecting"
  | "error"
  | "idle"
  | "queued"
  | "countdown"
  | "playing"
  | "result";

/** Transport health, tracked separately from `phase` so a drop mid-match doesn't reset the game. */
export type ConnectionState = "connecting" | "online" | "reconnecting" | "offline";

export interface RankedMatchState {
  phase: RankedPhase;
  errorMessage: string;
  queuedAt: number | null;
  match: MatchFoundPayload | null;
  secondsLeft: number;
  opponentPercent: number;
  result: MatchResultPayload | null;
  connection: ConnectionState;
  /** False while the opponent is inside their disconnect grace period. */
  opponentConnected: boolean;
  /** Grace period the server will wait for the opponent, in ms. */
  opponentGraceMs: number | null;
  /** Transient, user-facing message: rejected submission, rate limit, server error. */
  notice: string | null;
  /** Server-counted incorrect submissions in the current match. */
  mistakes: number;
  /** Set between emitting a correct-looking grid and the server ruling on it. */
  awaitingVerdict: boolean;
  canRetrySubmission: boolean;
  /** Difficulty of the last queue join, so "play again" can requeue in one tap. */
  lastDifficulty: Difficulty | null;
}

const INITIAL_STATE: RankedMatchState = {
  phase: "connecting",
  errorMessage: "",
  queuedAt: null,
  match: null,
  secondsLeft: 0,
  opponentPercent: 0,
  result: null,
  connection: "connecting",
  opponentConnected: true,
  opponentGraceMs: null,
  notice: null,
  mistakes: 0,
  awaitingVerdict: false,
  canRetrySubmission: false,
  lastDifficulty: null,
};

export interface RankedMatchController extends RankedMatchState {
  joinQueue: (difficulty: Difficulty) => void;
  leaveQueue: () => void;
  reportProgress: (percent: number) => void;
  submit: (payload: string) => void;
  retrySubmission: () => void;
  /** Back to difficulty selection, keeping the socket. */
  playAgain: () => void;
  /** Requeue at the same difficulty as the last match. */
  playAgainSameDifficulty: () => void;
  dismissNotice: () => void;
}

export function useRankedMatch(gameType: GameType): RankedMatchController {
  const router = useRouter();
  const socketRef = useRef<AppClientSocket | null>(null);
  const reconnectAttemptRef = useRef<Promise<void> | null>(null);
  const expectedMatchIdRef = useRef<string | null>(null);
  const [state, setState] = useState<RankedMatchState>(INITIAL_STATE);
  const stateRef = useRef<RankedMatchState>(INITIAL_STATE);
  const submissionRef = useRef<{ matchId: string; payload: string } | null>(null);

  // Run transitions once, outside React's replayable state updater callbacks.
  // The ref also closes the gap between a double tap and the next render.
  const updateState = useCallback((transition: (previous: RankedMatchState) => RankedMatchState) => {
    const next = transition(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const patch = useCallback((changes: Partial<RankedMatchState>) => {
    updateState((prev) => ({ ...prev, ...changes }));
  }, [updateState]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let failedAdmissions = 0;

    void (async () => {
      const ticket = await getRealtimeTicket();
      if (cancelled) return;
      if (!ticket) {
        patch({ phase: "error", errorMessage: "Not signed in.", connection: "offline" });
        return;
      }

      const socket = createRealtimeSocket(ticket);
      socketRef.current = socket;

      socket.on("connect", () => {
        failedAdmissions = 0;
        const rememberedMatchId = readRememberedRankedMatch(gameType);
        expectedMatchIdRef.current = rememberedMatchId;
        if (rememberedMatchId) socket.emit("match:sync", { matchId: rememberedMatchId });
        updateState((prev) => {
          // A reconnect must not throw away a live match — the server replays
          // it via match:resume. Only the very first connect opens the lobby.
          if (prev.phase === "connecting") {
            return { ...prev, phase: "idle", connection: "online" };
          }
          if (prev.phase === "queued") {
            // The server drops queue entries on disconnect, so the queue is
            // genuinely gone; say so rather than spinning forever.
            return {
              ...prev,
              phase: "idle",
              queuedAt: null,
              connection: "online",
              notice: "Your connection dropped, so you left the queue. Ready when you are.",
            };
          }
          return { ...prev, connection: "online" };
        });
      });

      socket.on("disconnect", () => {
        updateState((prev) =>
          prev.phase === "result" || prev.phase === "error"
            ? { ...prev, connection: "offline" }
            : { ...prev, connection: "reconnecting" },
        );
      });

      socket.on("connect_error", () => {
        updateState((prev) => ({ ...prev, connection: "reconnecting" }));

        // A middleware rejection destroys this Socket.IO Socket. Admission
        // tickets are also one-use, so recover with a fresh ticket *and* an
        // explicit connect(), while coalescing duplicate connect_error events.
        if (reconnectAttemptRef.current) return;
        const attempt = new Promise<void>((resolve) => {
          // A refused admission needs an explicit reconnect. Back off here so
          // an outage cannot spin through the BFF ticket rate limit.
          retryTimer = setTimeout(resolve, Math.min(15_000, 1_000 * 2 ** Math.min(failedAdmissions++, 4)));
        }).then(() => reconnectWithFreshTicket(
          socket, getRealtimeTicket, () => !cancelled && socketRef.current === socket,
        ))
          .then((started) => {
            if (!started && !cancelled && socketRef.current === socket && !socket.connected) {
              patch({
                phase: "error",
                errorMessage: "Couldn't reconnect to the match server.",
                connection: "offline",
              });
            }
          })
          .catch(() => {
            if (!cancelled && socketRef.current === socket) {
              patch({
                phase: "error",
                errorMessage: "Couldn't authenticate with the match server.",
                connection: "offline",
              });
            }
          })
          .finally(() => {
            if (reconnectAttemptRef.current === attempt) reconnectAttemptRef.current = null;
          });
        reconnectAttemptRef.current = attempt;
      });

      socket.on("queue:joined", ({ queuedAt }) => {
        if (stateRef.current.phase !== "queued") return;
        expectedMatchIdRef.current = null;
        forgetRankedMatch(gameType);
        patch({ phase: "queued", queuedAt, notice: null });
      });
      socket.on("queue:left", () => {
        if (stateRef.current.phase === "queued") patch({ phase: "idle", queuedAt: null });
      });
      socket.on("queue:error", ({ message }) => {
        patch(stateRef.current.phase === "queued"
          ? { phase: "idle", queuedAt: null, notice: message }
          : { notice: message });
      });

      socket.on("match:found", (match) => {
        if (match.gameType !== gameType) {
          router.replace(`/${match.gameType.toLowerCase()}/ranked`);
          return;
        }
        submissionRef.current = null;
        expectedMatchIdRef.current = match.matchId;
        rememberRankedMatch(gameType, match.matchId);
        patch({
          phase: match.startsAt > Date.now() ? "countdown" : "playing",
          match,
          lastDifficulty: match.difficulty,
          secondsLeft: Math.max(0, Math.ceil((match.startsAt - Date.now()) / 1000)),
          opponentPercent: 0,
          opponentConnected: true,
          opponentGraceMs: null,
          mistakes: 0,
          awaitingVerdict: false,
          canRetrySubmission: false,
          notice: null,
          result: null,
        });
      });
      socket.on("match:resume", (match) => {
        if (match.gameType !== gameType) {
          router.replace(`/${match.gameType.toLowerCase()}/ranked`);
          return;
        }
        expectedMatchIdRef.current = match.matchId;
        rememberRankedMatch(gameType, match.matchId);
        if (stateRef.current.phase === "result" && stateRef.current.result?.matchId === match.matchId) return;
        const pending = submissionRef.current;
        const retrying = pending?.matchId === match.matchId;
        patch({
          phase: match.startsAt > Date.now() ? "countdown" : "playing",
          secondsLeft: Math.max(0, Math.ceil((match.startsAt - Date.now()) / 1000)),
          match,
          lastDifficulty: match.difficulty,
          awaitingVerdict: retrying,
          canRetrySubmission: false,
          notice: "Reconnected — your match is still live.",
        });
        if (retrying) socket.emit("match:submit", pending);
      });
      socket.on("match:opponentProgress", ({ matchId, percent }) => {
        if (expectedMatchIdRef.current === matchId) patch({ opponentPercent: percent });
      });
      socket.on("match:opponentDisconnected", ({ matchId, graceMs }) => {
        if (expectedMatchIdRef.current === matchId) patch({ opponentConnected: false, opponentGraceMs: graceMs });
      });
      socket.on("match:opponentReconnected", ({ matchId }) => {
        if (expectedMatchIdRef.current === matchId) patch({ opponentConnected: true, opponentGraceMs: null });
      });
      socket.on("match:rejected", ({ matchId, mistakes }) => {
        if (expectedMatchIdRef.current !== matchId) return;
        submissionRef.current = null;
        patch({
          mistakes,
          awaitingVerdict: false,
          canRetrySubmission: false,
          notice: "That grid isn't correct yet — keep going.",
        });
      });
      socket.on("match:result", (result) => {
        // Ignore a late replay for a match whose queue pointer was already
        // cleared/replaced while the membership query was in flight.
        if (expectedMatchIdRef.current !== result.matchId) return;
        submissionRef.current = null;
        rememberRankedMatch(gameType, result.matchId);
        patch({ phase: "result", result, awaitingVerdict: false, canRetrySubmission: false, notice: null });
      });
      socket.on("error", ({ message }) => patch({
        notice: message,
        awaitingVerdict: false,
        canRetrySubmission: submissionRef.current !== null,
      }));
    })().catch(() => {
      if (!cancelled) {
        patch({
          phase: "error",
          errorMessage: "Couldn't authenticate with the match server.",
          connection: "offline",
        });
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      reconnectAttemptRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [gameType, patch, router, updateState]);

  // Countdown ticker — separate effect so it only (re)starts when a new match arrives.
  const countdownMatchId = state.phase === "countdown" ? state.match?.matchId : null;
  const countdownStartsAt = state.match?.startsAt ?? 0;
  useEffect(() => {
    if (!countdownMatchId) return;
    const interval = setInterval(() => {
      const secondsLeft = Math.ceil((countdownStartsAt - Date.now()) / 1000);
      if (secondsLeft <= 0) {
        patch({ phase: "playing", opponentPercent: 0 });
      } else {
        patch({ secondsLeft });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [countdownMatchId, countdownStartsAt, patch]);

  const joinQueue = useCallback(
    (difficulty: Difficulty) => {
      if (stateRef.current.phase !== "idle" || !socketRef.current?.connected) return;
      const modeId = rankedModeIdFor(gameType, difficulty);
      if (!modeId) {
        patch({ phase: "idle", notice: "That ranked mode isn't available." });
        return;
      }
      updateState((prev) =>
        // Guard the double-tap: the phase only becomes "queued" once the
        // server acknowledges, so without this a fast second tap emits twice.
        prev.phase !== "idle"
          ? prev
          : { ...prev, phase: "queued", queuedAt: null, lastDifficulty: difficulty, notice: null },
      );
      socketRef.current?.emit("queue:join", { modeId });
    },
    [gameType, patch, updateState],
  );

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit("queue:leave");
  }, []);

  const reportProgress = useCallback((percent: number) => {
    updateState((prev) => {
      if (prev.phase === "playing" && prev.match && socketRef.current?.connected) {
        socketRef.current.emit("match:progress", { matchId: prev.match.matchId, percent });
      }
      return prev;
    });
  }, [updateState]);

  const submit = useCallback((payload: string) => {
    updateState((prev) => {
      if (!prev.match || prev.phase !== "playing" || prev.awaitingVerdict) return prev;
      submissionRef.current = { matchId: prev.match.matchId, payload };
      if (!socketRef.current?.connected) return { ...prev, notice: "Your solution will be checked when you reconnect." };
      socketRef.current.emit("match:submit", submissionRef.current);
      return { ...prev, awaitingVerdict: true, canRetrySubmission: false };
    });
  }, [updateState]);

  const retrySubmission = useCallback(() => {
    const pending = submissionRef.current;
    if (pending && pending.matchId === expectedMatchIdRef.current) submit(pending.payload);
  }, [submit]);

  const playAgain = useCallback(() => {
    expectedMatchIdRef.current = null;
    submissionRef.current = null;
    forgetRankedMatch(gameType);
    updateState((prev) => ({
      ...INITIAL_STATE,
      phase: prev.connection === "online" ? "idle" : "connecting",
      connection: prev.connection,
      lastDifficulty: prev.lastDifficulty,
    }));
  }, [gameType, updateState]);

  const playAgainSameDifficulty = useCallback(() => {
    if (stateRef.current.phase !== "result") return;
    expectedMatchIdRef.current = null;
    submissionRef.current = null;
    forgetRankedMatch(gameType);
    updateState((prev) => {
      const difficulty = prev.lastDifficulty;
      if (prev.phase !== "result") return prev;
      if (!difficulty || !socketRef.current?.connected) {
        return { ...INITIAL_STATE, phase: "idle", connection: prev.connection, lastDifficulty: prev.lastDifficulty };
      }
      const modeId = rankedModeIdFor(gameType, difficulty);
      if (!modeId) {
        return {
          ...INITIAL_STATE,
          phase: "idle",
          connection: prev.connection,
          notice: "That ranked mode isn't available.",
        };
      }
      socketRef.current?.emit("queue:join", { modeId });
      return {
        ...INITIAL_STATE,
        phase: "queued",
        connection: prev.connection,
        lastDifficulty: difficulty,
      };
    });
  }, [gameType, updateState]);

  const dismissNotice = useCallback(() => patch({ notice: null }), [patch]);

  return useMemo(
    () => ({
      ...state,
      joinQueue,
      leaveQueue,
      reportProgress,
      submit,
      retrySubmission,
      playAgain,
      playAgainSameDifficulty,
      dismissNotice,
    }),
    [
      state,
      joinQueue,
      leaveQueue,
      reportProgress,
      submit,
      retrySubmission,
      playAgain,
      playAgainSameDifficulty,
      dismissNotice,
    ],
  );
}
