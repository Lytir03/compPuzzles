import type { Difficulty, GameType } from "@/database/generated/client/enums";

export interface MatchFoundPayload {
  matchId: string;
  gameType: GameType;
  difficulty: Difficulty;
  /** Given/clue state — never the solution. */
  payload: string;
  opponentUsername: string;
  /** Server wall-clock timestamp (ms) both clients count down to, so latency doesn't desync them. */
  startsAt: number;
}

export type MatchEndReason = "completion" | "abandonment" | "draw";

export interface MatchResultPayload {
  matchId: string;
  outcome: "WIN" | "LOSS" | "DRAW";
  reason: MatchEndReason;
  /** Rounded — server-computed Glicko-2 update, never client input. */
  ratingBefore: number;
  ratingAfter: number;
}

export interface ClientToServerEvents {
  "queue:join": (data: { gameType: GameType; difficulty: Difficulty }) => void;
  "queue:leave": () => void;
  "match:progress": (data: { matchId: string; percent: number }) => void;
  "match:submit": (data: { matchId: string; payload: string }) => void;
}

export interface ServerToClientEvents {
  "queue:joined": (data: { queuedAt: number }) => void;
  "queue:left": () => void;
  "queue:error": (data: { message: string }) => void;
  "match:found": (data: MatchFoundPayload) => void;
  /** Sent instead of match:found when a reconnect recovers an in-progress match. */
  "match:resume": (data: MatchFoundPayload) => void;
  "match:opponentProgress": (data: { matchId: string; percent: number }) => void;
  "match:opponentDisconnected": (data: { matchId: string }) => void;
  "match:opponentReconnected": (data: { matchId: string }) => void;
  "match:result": (data: MatchResultPayload) => void;
  error: (data: { message: string }) => void;
}
