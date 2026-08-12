"use server";

import { createSignedToken } from "@/lib/signedToken";
import { REALTIME_TOKEN_PURPOSE, REALTIME_TOKEN_TTL_MS } from "./sessionCookie";
import { getCurrentUser } from "./currentUser";

/**
 * Mints a short-lived signed token for the Socket.IO handshake's `auth.token`
 * — see realtime/auth.ts for why this can't just be the session cookie
 * (different origin, SameSite=Lax doesn't cross-origin). This runs
 * same-origin, so the httpOnly cookie works normally here.
 *
 * It used to return the bare userId, which made the realtime server
 * impersonable by anyone who learned another player's id. It's now signed and
 * expiring, so possession of an id is not possession of a credential.
 */
export async function getRealtimeToken(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return createSignedToken(user.id, REALTIME_TOKEN_PURPOSE, REALTIME_TOKEN_TTL_MS);
}
