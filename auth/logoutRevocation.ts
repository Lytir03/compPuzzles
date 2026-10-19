import "server-only";

import { markAuthRevoked } from "./redis";

type RevocationWriter = (kind: "sid", value: string) => Promise<void>;

/**
 * Must complete before Supabase cookies are cleared. Throwing intentionally
 * leaves the authenticated session in place, so the user can retry and an
 * already-admitted realtime socket is never orphaned from its revocation.
 */
export async function requireLogoutRevocation(
  context: { sessionId: string | null } | null,
  write: RevocationWriter = markAuthRevoked,
): Promise<void> {
  if (!context) return;
  if (!context.sessionId) throw new Error("Secure logout could not identify the active session");
  await write("sid", context.sessionId);
}
