import "server-only";

import { createHmac } from "node:crypto";
import { isProduction, requireServerEnv } from "./env";

// Matches the standalone realtime development adapter. Production never uses
// this predictable fallback and requires REALTIME_REDIS_KEY_SECRET.
const DEV_HMAC_KEY = Buffer.from("comppuzzles-local-only", "utf8");

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return { url: url.replace(/\/$/, ""), token };
  if (url || token) throw new Error("Both Upstash REST variables are required");
  return null;
}

export function keyedDigest(value: string): string {
  const configured = process.env.REALTIME_REDIS_KEY_SECRET?.trim();
  if (!configured && isProduction()) requireServerEnv("REALTIME_REDIS_KEY_SECRET");
  if (configured && isProduction() && Buffer.byteLength(configured, "utf8") < 32) {
    throw new Error("REALTIME_REDIS_KEY_SECRET must contain at least 32 bytes");
  }
  const key = configured ? Buffer.from(configured, "utf8") : DEV_HMAC_KEY;
  return createHmac("sha256", key).update(value).digest("hex");
}

export async function redisCommand(command: readonly (string | number)[]): Promise<unknown> {
  const config = redisConfig();
  if (!config) {
    throw new Error("Distributed security store is unavailable");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("Distributed security store rejected a command");
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error) throw new Error("Distributed security store returned an error");
  return payload.result;
}

export function hasDistributedRedis(): boolean {
  return redisConfig() !== null;
}

// Mirrors the in-memory fallback in rateLimit.ts: local dev has no Upstash
// instance, so logout revocation would otherwise hard-fail every sign-out.
const localRevocations = new Map<string, { marker: string; expiresAt: number }>();

function markAuthRevokedLocally(key: string, marker: string, ttlSeconds: number): void {
  if (isProduction() || process.env.AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT !== "true") {
    throw new Error("Distributed security store is unavailable");
  }
  localRevocations.set(key, { marker, expiresAt: Date.now() + ttlSeconds * 1_000 });
}

export async function markAuthRevoked(
  kind: "sid" | "sub",
  value: string,
): Promise<void> {
  const ttlRaw = Number(process.env.AUTH_REVOCATION_TTL_SECONDS ?? 604_800);
  const ttlSeconds = Number.isInteger(ttlRaw) && ttlRaw >= 300 ? ttlRaw : 604_800;
  const key = `cp:rt:revoked:${kind}:${keyedDigest(value)}`;
  // Subject revocation is a timestamp cutoff: password changes must reject
  // old tickets/sockets without blocking tickets minted by a later login for
  // the entire marker TTL. Session ids are immutable and use a boolean.
  const marker = kind === "sub" ? String(Math.floor(Date.now() / 1_000)) : "1";
  if (!hasDistributedRedis()) {
    markAuthRevokedLocally(key, marker, ttlSeconds);
    return;
  }
  await redisCommand(["SET", key, marker, "EX", ttlSeconds]);
}
