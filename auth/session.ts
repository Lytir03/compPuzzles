import "server-only";
import { cookies } from "next/headers";
import { createSignedToken, verifySignedToken } from "@/lib/signedToken";
import { SESSION_COOKIE_NAME, SESSION_TOKEN_PURPOSE } from "./sessionCookie";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  // Signed, so a cookie hand-edited to another player's userId is rejected
  // rather than honoured. See lib/signedToken.ts.
  return verifySignedToken(raw, SESSION_TOKEN_PURPOSE);
}

export async function setSessionUserId(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSignedToken(userId, SESSION_TOKEN_PURPOSE, SESSION_TTL_MS), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No `secure` flag — this only ever runs over http://localhost. Revisit
    // once this deploys somewhere with TLS.
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
