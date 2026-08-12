import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minimal HMAC-signed, expiring tokens.
 *
 * Both the session cookie (auth/session.ts) and the Socket.IO handshake token
 * (auth/realtimeToken.ts → realtime/auth.ts) used to be the bare userId. That
 * meant anyone who learned another player's id — it's rendered into pages, and
 * it travels in match payloads — could authenticate as them against the
 * realtime server, forcibly disconnect them mid-match (realtime/server.ts
 * replaces an existing socket for the same user), and hand them a loss by
 * abandonment. Signing closes that: an id is no longer a credential.
 *
 * This is deliberately dependency-free and symmetric — it is not a full auth
 * system, and it does not turn the username-only login into a real one (see
 * CLAUDE.md: Clerk is the eventual answer). It only ensures that a token can't
 * be forged or replayed forever without the server's secret.
 *
 * `purpose` domain-separates tokens so a stolen realtime token can't be pasted
 * in as a session cookie, or vice versa.
 */

const DEV_SECRET_FALLBACK = "comppuzzles-local-dev-secret-do-not-use-in-production";

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 16) {
    cachedSecret = configured;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (32+ random chars) outside local development.");
  }

  // Local-only build (CLAUDE.md). A fixed fallback keeps sessions valid across
  // the Next.js and realtime processes without any setup, at the cost of being
  // public — which is exactly why it's refused in production above.
  cachedSecret = DEV_SECRET_FALLBACK;
  return cachedSecret;
}

/** Test seam — lets tests set/reset the secret without mutating process.env ordering. */
export function __setSecretForTesting(secret: string | null): void {
  cachedSecret = secret;
}

export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Produces `<subject>.<purpose>.<expiresAtMs>.<signature>`. The subject is
 * base64url-encoded so a value containing "." can't shift the field boundaries.
 */
export function createSignedToken(subject: string, purpose: string, ttlMs: number): string {
  const expiresAt = Date.now() + ttlMs;
  const encodedSubject = Buffer.from(subject, "utf8").toString("base64url");
  const body = `${encodedSubject}.${purpose}.${expiresAt}`;
  return `${body}.${sign(body)}`;
}

/** Returns the subject, or null if the token is malformed, tampered with, expired, or for another purpose. */
export function verifySignedToken(
  token: string,
  purpose: string,
  now: number = Date.now(),
): string | null {
  if (typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [encodedSubject, tokenPurpose, expiresAtRaw, signature] = parts;
  const body = `${encodedSubject}.${tokenPurpose}.${expiresAtRaw}`;
  if (!safeEqual(signature, sign(body))) return null;

  // Purpose and expiry are checked only after the signature, so neither can be
  // probed by an attacker without a valid signature to begin with.
  if (tokenPurpose !== purpose) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || now >= expiresAt) return null;

  const subject = Buffer.from(encodedSubject, "base64url").toString("utf8");
  return subject.length > 0 ? subject : null;
}
