import { createHmac } from "node:crypto";

interface RedisResponse {
  result?: unknown;
  error?: string;
}

interface LocalEntry {
  value: string;
  expiresAt: number;
}

const localStore = new Map<string, LocalEntry>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function credentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function command(parts: readonly (string | number)[]): Promise<unknown> {
  const config = credentials();
  if (!config) {
    throw new Error("Upstash REST credentials are not configured");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(parts),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`Upstash request failed (${response.status})`);

  const payload = (await response.json()) as RedisResponse;
  if (payload.error) throw new Error("Upstash command failed");
  return payload.result ?? null;
}

function pruneLocal(key: string): LocalEntry | null {
  const entry = localStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localStore.delete(key);
    return null;
  }
  return entry;
}

/** Hashes identifiers before they become Redis keys, avoiding raw user/session ids in operations data. */
export function realtimeRedisKey(
  scope: "jti" | "sid" | "sub" | "disconnect" | "rate" | "practice",
  value: string,
): string {
  const secret = process.env.REALTIME_REDIS_KEY_SECRET?.trim();
  if (!secret) {
    if (isProduction()) throw new Error("REALTIME_REDIS_KEY_SECRET is required in production");
    // Stable development-only key. Production is deliberately fail-closed.
    return `cp:rt:${scope}:${createHmac("sha256", "comppuzzles-local-only").update(value).digest("hex")}`;
  }
  const prefix = scope === "sid" || scope === "sub" ? `revoked:${scope}` : scope;
  return `cp:rt:${prefix}:${createHmac("sha256", secret).update(value).digest("hex")}`;
}

/** Atomic SET NX with expiry; false means replay or unavailable protection. */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const config = credentials();
  if (config) {
    try {
      return (await command(["SET", key, "1", "NX", "EX", ttlSeconds])) === "OK";
    } catch {
      return false;
    }
  }
  if (isProduction()) return false;

  if (pruneLocal(key)) return false;
  localStore.set(key, { value: "1", expiresAt: Date.now() + ttlSeconds * 1_000 });
  return true;
}

/** Revocation checks fail closed in production when Redis is unavailable. */
export async function isRevoked(key: string): Promise<boolean> {
  const config = credentials();
  if (config) {
    try {
      return Number(await command(["EXISTS", key])) === 1;
    } catch {
      return true;
    }
  }
  if (isProduction()) return true;
  return pruneLocal(key) !== null;
}

/**
 * Reads an account-wide `revoked_before` Unix timestamp. Infinity means the
 * security store was unavailable/invalid and deliberately fails closed.
 */
export async function getRevocationCutoff(key: string): Promise<number | null> {
  const config = credentials();
  if (config) {
    try {
      const result = await command(["GET", key]);
      if (result === null) return null;
      const cutoff = Number(result);
      return Number.isSafeInteger(cutoff) && cutoff >= 0 ? cutoff : Number.POSITIVE_INFINITY;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
  if (isProduction()) return Number.POSITIVE_INFINITY;
  const value = pruneLocal(key)?.value;
  if (value === undefined) return null;
  const cutoff = Number(value);
  return Number.isSafeInteger(cutoff) && cutoff >= 0 ? cutoff : Number.POSITIVE_INFINITY;
}

/** One-command revocation sweep; unavailable is distinct from "all clear". */
export async function getValues(
  keys: readonly string[],
): Promise<{ available: boolean; values: (string | null)[] }> {
  if (keys.length === 0) return { available: true, values: [] };
  const config = credentials();
  if (config) {
    try {
      const result = await command(["MGET", ...keys]);
      if (!Array.isArray(result) || result.length !== keys.length) {
        return { available: false, values: [] };
      }
      return {
        available: true,
        values: result.map((value) => (typeof value === "string" ? value : null)),
      };
    } catch {
      return { available: false, values: [] };
    }
  }
  if (isProduction()) return { available: false, values: [] };
  return {
    available: true,
    values: keys.map((key) => pruneLocal(key)?.value ?? null),
  };
}

export async function setExpiringValue(key: string, value: string, ttlMs: number): Promise<boolean> {
  const config = credentials();
  if (config) {
    try {
      return (await command(["SET", key, value, "PX", Math.max(1, Math.ceil(ttlMs))])) === "OK";
    } catch {
      return false;
    }
  }
  if (isProduction()) return false;
  localStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  return true;
}

export async function getValue(key: string): Promise<{ available: boolean; value: string | null }> {
  const config = credentials();
  if (config) {
    try {
      const result = await command(["GET", key]);
      return { available: true, value: typeof result === "string" ? result : null };
    } catch {
      return { available: false, value: null };
    }
  }
  if (isProduction()) return { available: false, value: null };
  return { available: true, value: pruneLocal(key)?.value ?? null };
}

/** Atomically consumes a short-lived value (practice assignment, nonce). */
export async function getAndDeleteValue(
  key: string,
): Promise<{ available: boolean; value: string | null }> {
  const config = credentials();
  if (config) {
    try {
      const result = await command(["GETDEL", key]);
      return { available: true, value: typeof result === "string" ? result : null };
    } catch {
      return { available: false, value: null };
    }
  }
  if (isProduction()) return { available: false, value: null };
  const entry = pruneLocal(key);
  localStore.delete(key);
  return { available: true, value: entry?.value ?? null };
}

export async function deleteKey(key: string): Promise<void> {
  const config = credentials();
  if (config) {
    await command(["DEL", key]).catch(() => undefined);
    return;
  }
  localStore.delete(key);
}

const FIXED_WINDOW_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {current, ttl}",
].join(" ");

/** Shared production event limiter. Any Redis/configuration failure denies the event. */
export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  if (!credentials()) return { allowed: false, retryAfterMs: windowMs };
  try {
    const result = await command(["EVAL", FIXED_WINDOW_SCRIPT, 1, key, windowMs]);
    if (!Array.isArray(result) || result.length !== 2) {
      return { allowed: false, retryAfterMs: windowMs };
    }
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      return { allowed: false, retryAfterMs: windowMs };
    }
    return { allowed: count <= limit, retryAfterMs: count <= limit ? 0 : Math.max(1, ttl) };
  } catch {
    return { allowed: false, retryAfterMs: windowMs };
  }
}

/** Test-only reset for the process-local development adapter. */
export function clearLocalStore(): void {
  localStore.clear();
}
