import type { DefaultEventsMap, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export interface SocketData {
  /** `id` is the private competitor UUID, resolved server-side from auth.uid(). */
  user: {
    id: string;
    username: string;
    authUserId: string;
    sessionId: string;
    ticketIssuedAt: number;
    revocationCheckedAt: number;
  };
}

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

/**
 * Process-local state. Fine for a single realtime-server instance (this is
 * a modular monolith, no horizontal scaling planned) — a restart drops
 * these, but the DB-backed queue and Match/MatchParticipant rows are the
 * source of truth, so reconnect recovery (see server.ts) doesn't depend on
 * any of this surviving a restart.
 */

/** One active socket per private competitor id — a fresh connection replaces the old one. */
export const activeSockets = new Map<string, AppSocket>();

/** Returns only the process-owned socket that is still transport-connected. */
export function getActiveSocket(competitorId: string): AppSocket | null {
  const socket = activeSockets.get(competitorId);
  return socket?.connected ? socket : null;
}

/** Guards mutations that may have waited behind async auth/rate-limit/queue work. */
export function ownsActiveSocket(socket: AppSocket): boolean {
  return getActiveSocket(socket.data.user.id)?.id === socket.id;
}

/** Pending disconnect-grace-period abandonment timers, keyed by `${matchId}:${userId}`. */
export const abandonmentTimers = new Map<string, NodeJS.Timeout>();

export function abandonmentTimerKey(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}
