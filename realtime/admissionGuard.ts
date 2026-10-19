import { createHash } from "node:crypto";

interface AdmissionBucket {
  count: number;
  resetAt: number;
}

const TICKET_LIMIT = 1;
const TICKET_WINDOW_MS = 120_000;
const MAX_BUCKETS = 2_048;
const MAX_IN_FLIGHT = 64;
const buckets = new Map<string, AdmissionBucket>();
let inFlight = 0;

function fingerprint(value: string): string {
  return createHash("sha256").update("ticket\0").update(value).digest("hex");
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function makeRoom(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  evictExpired(now);
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

function consume(key: string, limit: number, windowMs: number, now: number): boolean {
  const current = buckets.get(key);
  if (current && current.resetAt > now) {
    current.count++;
    // Refresh insertion order so the hard cap evicts least-recently-used keys.
    buckets.delete(key);
    buckets.set(key, current);
    return current.count <= limit;
  }

  if (current) buckets.delete(key);
  makeRoom(now);
  buckets.set(key, { count: 1, resetAt: now + windowMs });
  return true;
}

/**
 * Cheap, process-local admission defence that runs before Ed25519 and Redis.
 * It stores only fixed-size ticket hashes, caps concurrent expensive work and
 * has a hard memory ceiling under adversarial high-cardinality input. It does
 * not key on proxy/forwarding headers or a potentially shared edge address.
 */
export function beginRealtimeAdmission(
  ticket: string,
  now = Date.now(),
): (() => void) | null {
  if (inFlight >= MAX_IN_FLIGHT) return null;
  if (!consume(fingerprint(ticket), TICKET_LIMIT, TICKET_WINDOW_MS, now)) return null;

  inFlight++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlight = Math.max(0, inFlight - 1);
  };
}

export function clearAdmissionGuard(): void {
  buckets.clear();
  inFlight = 0;
}

export function admissionGuardSize(): number {
  return buckets.size;
}

export function admissionInFlight(): number {
  return inFlight;
}
