import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./sessionCookie";

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionUserId(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No `secure` flag — this only ever runs over http://localhost. Revisit
    // once this deploys somewhere with TLS.
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
