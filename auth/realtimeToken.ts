"use server";

import { randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { getCurrentUser } from "./currentUser";
import { getCanonicalOrigin, isProduction, requireServerEnv } from "./env";
import { enforceAuthRateLimit } from "./rateLimit";
import { assertSameOrigin, getClientIp } from "./requestSecurity";
import { getVerifiedAuthContext } from "./session";

const REALTIME_TICKET_TTL_SECONDS = 90;
let signingKeyCache: { pem: string; key: Promise<CryptoKey> } | null = null;

function normalizePem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function getSigningKey(): Promise<CryptoKey> {
  const pem = normalizePem(requireServerEnv("REALTIME_JWS_PRIVATE_KEY"));
  if (!signingKeyCache || signingKeyCache.pem !== pem) {
    signingKeyCache = { pem, key: importPKCS8(pem, "EdDSA") };
  }
  return signingKeyCache.key;
}

function realtimeIssuer(): string {
  const configured = process.env.REALTIME_JWS_ISSUER?.trim();
  if (configured) return configured;
  if (isProduction()) return requireServerEnv("REALTIME_JWS_ISSUER");
  return getCanonicalOrigin();
}

function realtimeAudience(): string {
  const configured = process.env.REALTIME_JWS_AUDIENCE?.trim();
  if (configured) return configured;
  if (isProduction()) return requireServerEnv("REALTIME_JWS_AUDIENCE");
  return "comppuzzles-realtime";
}

/**
 * Mints a one-use admission ticket. The browser receives no Supabase token;
 * Railway maps `sub` (auth UUID) to an active competitor itself.
 */
export async function getRealtimeTicket(): Promise<string | null> {
  await assertSameOrigin();
  // Sequential on purpose: two concurrent Supabase clients must never race to
  // rotate the same one-use refresh token.
  const context = await getVerifiedAuthContext({ cookiesWritable: true });
  const currentUser = context ? await getCurrentUser() : null;
  if (!context?.sessionId || !currentUser || currentUser.authUserId !== context.user.id) return null;

  const ip = await getClientIp();
  await enforceAuthRateLimit("ticket", ip, context.user.id);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: context.sessionId, v: 1 })
    .setProtectedHeader({
      alg: "EdDSA",
      kid: requireServerEnv("REALTIME_JWS_KEY_ID"),
      typ: "rt+jwt",
    })
    .setIssuer(realtimeIssuer())
    .setAudience(realtimeAudience())
    .setSubject(context.user.id)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 5)
    .setExpirationTime(now + REALTIME_TICKET_TTL_SECONDS)
    .sign(await getSigningKey());
}

/** @deprecated Use getRealtimeTicket; retained during the client migration. */
export async function getRealtimeToken(): Promise<string | null> {
  return getRealtimeTicket();
}
