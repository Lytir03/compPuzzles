import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isProduction, requireServerEnv } from "./env";

const RECOVERY_COOKIE_NAME = isProduction() ? "__Host-cp-recovery" : "cp-recovery-local";
const RECOVERY_TTL_SECONDS = 10 * 60;

function signature(payload: string): string {
  const secret = requireServerEnv("AUTH_FLOW_HMAC_SECRET");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_FLOW_HMAC_SECRET must contain at least 32 bytes");
  }
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export function createRecoveryProof(sessionId: string): string {
  const expiresAt = Math.floor(Date.now() / 1_000) + RECOVERY_TTL_SECONDS;
  const payload = `${expiresAt}.${sessionId}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyRecoveryProof(value: string, sessionId: string): boolean {
  if (value.length > 512) return false;
  const firstDot = value.indexOf(".");
  const lastDot = value.lastIndexOf(".");
  if (firstDot <= 0 || lastDot <= firstDot) return false;
  const expiresRaw = value.slice(0, firstDot);
  const embeddedSessionId = value.slice(firstDot + 1, lastDot);
  const received = value.slice(lastDot + 1);
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1_000)) return false;
  if (embeddedSessionId !== sessionId) return false;
  const expected = signature(`${expiresRaw}.${embeddedSessionId}`);
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function hasRecoveryProof(sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false;
  const store = await cookies();
  const value = store.get(RECOVERY_COOKIE_NAME)?.value;
  return Boolean(value && verifyRecoveryProof(value, sessionId));
}

export async function consumeRecoveryProof(sessionId: string | null): Promise<boolean> {
  const store = await cookies();
  const value = store.get(RECOVERY_COOKIE_NAME)?.value;
  const valid = Boolean(sessionId && value && verifyRecoveryProof(value, sessionId));
  store.set(RECOVERY_COOKIE_NAME, "", {
    domain: undefined,
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: isProduction(),
  });
  return valid;
}

export const recoveryCookie = {
  name: RECOVERY_COOKIE_NAME,
  maxAge: RECOVERY_TTL_SECONDS,
} as const;
