import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";

export type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** One socket per call — the caller (a client component) owns its lifecycle and should disconnect() on unmount. */
export function createRealtimeSocket(ticket: string): AppClientSocket {
  return io(REALTIME_URL, { auth: { ticket } });
}
