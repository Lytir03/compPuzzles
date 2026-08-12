"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRealtimeToken } from "@/auth/realtimeToken";
import type { Difficulty, GameType } from "@/database/generated/client/enums";
import type { MatchFoundPayload, MatchResultPayload } from "@/realtime/events";
import { createRealtimeSocket, type AppClientSocket } from "@/realtime/client";

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
  lastDifficulty: null,
};

export interface RankedMatchController extends RankedMatchState {
  joinQueue: (difficulty: Difficulty) => void;
  leaveQueue: () => void;
  reportProgress: (percent: number) => void;
  submit: (payload: string) => void;
  /** Back to difficulty selection, keeping the socket. */
  playAgain: () => void;
  /** Requeue at the same difficulty as the last match. */
  playAgainSameDifficulty: () => void;
  dismissNotice: () => void;
}

export function useRankedMatch(gameType: GameType): RankedMatchController {
  const socketRef = useRef<AppClientSocket | null>(null);
  const [state, setState] = useState<RankedMatchState>(INITIAL_STATE);

  const patch = useCallback((changes: Partial<RankedMatchState>) => {
    setState((prev) => ({ ...prev, ...changes }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getRealtimeToken();
      if (cancelled) return;
      if (!token) {
        patch({ phase: "error", errorMessage: "Not signed in.", connection: "offline" });
        return;
      }

      const socket = createRealtimeSocket(token);
      socketRef.current = socket;

      socket.on("connect", () => {
        setState((prev) => {
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
        setState((prev) =>
          prev.phase === "result" || prev.phase === "error"
            ? { ...prev, connection: "offline" }
            : { ...prev, connection: "reconnecting" },
        );
      });

      socket.on("connect_error", () => {
        setState((prev) => {
          // Never connected at all: a hard error. Already in a session: this
          // is a failed reconnect attempt, and Socket.IO will keep retrying.
          if (prev.phase === "connecting") {
            return {
              ...prev,
              phase: "error",
              errorMessage: "Couldn't connect to the match server.",
              connection: "offline",
            };
          }
          return { ...prev, connection: "reconnecting" };
        });
        // The handshake token expires; mint a fresh one so long sessions can
        // still reconnect (see auth/sessionCookie.ts REALTIME_TOKEN_TTL_MS).
        void refreshToken(socket);
      });

      socket.on("queue:joined", ({ queuedAt }) => patch({ phase: "queued", queuedAt, notice: null }));
      socket.on("queue:left", () => patch({ phase: "idle", queuedAt: null }));
      socket.on("queue:error", ({ message }) => patch({ phase: "idle", queuedAt: null, notice: message }));

      socket.on("match:found", (match) =>
        patch({
          phase: "countdown",
          match,
          secondsLeft: Math.max(0, Math.ceil((match.startsAt - Date.now()) / 1000)),
          opponentPercent: 0,
          opponentConnected: true,
          opponentGraceMs: null,
          mistakes: 0,
          awaitingVerdict: false,
          notice: null,
          result: null,
        }),
      );
      socket.on("match:resume", (match) =>
        patch({
          phase: "playing",
          match,
          opponentPercent: 0,
          awaitingVerdict: false,
          notice: "Reconnected — your match is still live.",
        }),
      );
      socket.on("match:opponentProgress", ({ percent }) => patch({ opponentPercent: percent }));
      socket.on("match:opponentDisconnected", ({ graceMs }) =>
        patch({ opponentConnected: false, opponentGraceMs: graceMs }),
      );
      socket.on("match:opponentReconnected", () =>
        patch({ opponentConnected: true, opponentGraceMs: null }),
      );
      socket.on("match:rejected", ({ mistakes }) =>
        patch({
          mistakes,
          awaitingVerdict: false,
          notice: "That grid isn't correct yet — keep going.",
        }),
      );
      socket.on("match:result", (result) =>
        patch({ phase: "result", result, awaitingVerdict: false, notice: null }),
      );
      socket.on("error", ({ message }) => patch({ notice: message, awaitingVerdict: false }));
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [patch]);

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
      setState((prev) =>
        // Guard the double-tap: the phase only becomes "queued" once the
        // server acknowledges, so without this a fast second tap emits twice.
        prev.phase !== "idle"
          ? prev
          : { ...prev, phase: "queued", queuedAt: null, lastDifficulty: difficulty, notice: null },
      );
      socketRef.current?.emit("queue:join", { gameType, difficulty });
    },
    [gameType],
  );

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit("queue:leave");
  }, []);

  const reportProgress = useCallback((percent: number) => {
    setState((prev) => {
      if (prev.match) {
        socketRef.current?.emit("match:progress", { matchId: prev.match.matchId, percent });
      }
      return prev;
    });
  }, []);

  const submit = useCallback((payload: string) => {
    setState((prev) => {
      if (!prev.match || prev.awaitingVerdict) return prev;
      socketRef.current?.emit("match:submit", { matchId: prev.match.matchId, payload });
      return { ...prev, awaitingVerdict: true };
    });
  }, []);

  const playAgain = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      phase: prev.connection === "online" ? "idle" : "connecting",
      connection: prev.connection,
      lastDifficulty: prev.lastDifficulty,
    }));
  }, []);

  const playAgainSameDifficulty = useCallback(() => {
    setState((prev) => {
      const difficulty = prev.lastDifficulty;
      if (!difficulty || prev.connection !== "online") {
        return { ...INITIAL_STATE, phase: "idle", connection: prev.connection, lastDifficulty: prev.lastDifficulty };
      }
      socketRef.current?.emit("queue:join", { gameType, difficulty });
      return {
        ...INITIAL_STATE,
        phase: "queued",
        connection: prev.connection,
        lastDifficulty: difficulty,
      };
    });
  }, [gameType]);

  const dismissNotice = useCallback(() => patch({ notice: null }), [patch]);

  return useMemo(
    () => ({
      ...state,
      joinQueue,
      leaveQueue,
      reportProgress,
      submit,
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
      playAgain,
      playAgainSameDifficulty,
      dismissNotice,
    ],
  );
}

async function refreshToken(socket: AppClientSocket) {
  try {
    const token = await getRealtimeToken();
    if (token) socket.auth = { token };
  } catch {
    // Offline — Socket.IO keeps retrying with the existing token, and the
    // next successful refresh will pick up a fresh one.
  }
}
