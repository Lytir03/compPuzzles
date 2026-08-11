"use server";

import { getCurrentUser } from "./currentUser";

/**
 * Hands the client its own userId to pass into the Socket.IO handshake's
 * `auth.token` — see realtime/auth.ts for why this can't just be the
 * session cookie (different origin, SameSite=Lax doesn't cross-origin).
 * This runs same-origin, so the httpOnly cookie works normally here.
 */
export async function getRealtimeToken(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
