import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { getAllowedOrigins, isProduction } from "./env";

export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const rawOrigin = requestHeaders.get("origin");

  // Some non-browser test clients omit Origin. Production mutations must not.
  if (!rawOrigin) {
    if (isProduction()) throw new Error("Missing request origin");
    return;
  }

  let origin: string;
  try {
    origin = new URL(rawOrigin).origin;
  } catch {
    throw new Error("Invalid request origin");
  }

  if (!getAllowedOrigins().has(origin)) throw new Error("Untrusted request origin");
}

interface HeaderReader {
  get(name: string): string | null;
}

function validIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && candidate.length <= 64 && isIP(candidate) !== 0 ? candidate : null;
}

/**
 * Netlify removes the client-supplied version of this header and writes its
 * own connection IP. Other forwarding headers are attacker-controlled at the
 * public deployment boundary and must never become rate-limit identities.
 */
export function resolveClientIp(
  requestHeaders: HeaderReader,
  production: boolean = isProduction(),
): string {
  const netlifyIp = validIp(requestHeaders.get("x-nf-client-connection-ip"));
  if (production) {
    if (!netlifyIp) throw new Error("Missing or invalid trusted client IP");
    return netlifyIp;
  }

  if (netlifyIp) return netlifyIp;
  const developmentCandidates = [
    requestHeaders.get("cf-connecting-ip"),
    requestHeaders.get("x-real-ip"),
    requestHeaders.get("x-forwarded-for")?.split(",", 1)[0],
  ];
  for (const candidate of developmentCandidates) {
    const parsed = validIp(candidate);
    if (parsed) return parsed;
  }

  // Next's local dev server does not guarantee a forwarding header. A stable
  // loopback bucket keeps local auth usable without weakening production.
  return "127.0.0.1";
}

export async function getClientIp(): Promise<string> {
  return resolveClientIp(await headers());
}
