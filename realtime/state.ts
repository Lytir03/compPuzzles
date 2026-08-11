import type { User } from "@/database/generated/client/client";
import type { DefaultEventsMap, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export interface SocketData {
  user: User;
}

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

/**
 * Process-local state. Fine for a single realtime-server instance (this is
 * a modular monolith, no horizontal scaling planned) — a restart drops
 * these, but the DB-backed queue and Match/MatchParticipant rows are the
 * source of truth, so reconnect recovery (see server.ts) doesn't depend on
 * any of this surviving a restart.
 */

/** One active socket per userId — a fresh connection replaces the old one. */
export const activeSockets = new Map<string, AppSocket>();

/** Pending disconnect-grace-period abandonment timers, keyed by `${matchId}:${userId}`. */
export const abandonmentTimers = new Map<string, NodeJS.Timeout>();

export function abandonmentTimerKey(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}
