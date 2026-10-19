import { prisma } from "@/database/client";
import { CompetitorStatus } from "@/database/generated/client/enums";
import { decodeProtectedHeader, importSPKI, jwtVerify } from "jose";
import type { Socket } from "socket.io";
import { beginRealtimeAdmission } from "./admissionGuard";
import { claimOnce, getRevocationCutoff, isRevoked, realtimeRedisKey } from "./upstash";

const DEFAULT_AUDIENCE = "comppuzzles-realtime";
const MAX_TICKET_LIFETIME_SECONDS = 120;
const REPLAY_TTL_SECONDS = 120;
const MAX_TICKET_LENGTH = 8_192;

const keyCache = new Map<string, ReturnType<typeof importSPKI>>();

interface RealtimeClaims {
  sub: string;
  sid: string;
  jti: string;
  v: 1;
}

/**
 * Verifies the one-time Ed25519 ticket minted by the Next BFF. The browser
 * supplies it only in Socket.IO's `auth.ticket`; a Supabase access token is
 * never exposed to client JavaScript or handed to Railway.
 */
export async function authenticateSocket(socket: Socket) {
  const ticket = socket.handshake.auth?.ticket;
  if (typeof ticket !== "string" || ticket.length === 0 || ticket.length > MAX_TICKET_LENGTH) {
    return null;
  }
  const releaseAdmission = beginRealtimeAdmission(ticket);
  if (!releaseAdmission) return null;

  try {
    const issuer = process.env.REALTIME_JWS_ISSUER ||
      (process.env.NODE_ENV === "production"
        ? requiredEnv("REALTIME_JWS_ISSUER")
        : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
    const audience = process.env.REALTIME_JWS_AUDIENCE ||
      (process.env.NODE_ENV === "production" ? requiredEnv("REALTIME_JWS_AUDIENCE") : DEFAULT_AUDIENCE);
    const header = decodeProtectedHeader(ticket);
    if (header.alg !== "EdDSA" || header.typ !== "rt+jwt" || typeof header.kid !== "string") {
      return null;
    }

    const key = await publicKeyFor(header.kid);
    const { payload } = await jwtVerify(ticket, key, {
      algorithms: ["EdDSA"],
      issuer,
      audience,
      clockTolerance: 5,
      requiredClaims: ["sub", "sid", "jti", "iat", "nbf", "exp"],
    });

    if (!validClaims(payload)) return null;
    if (payload.exp! - payload.iat! > MAX_TICKET_LIFETIME_SECONDS) return null;

    // Claim immediately after signature/claim validation. Replays after a
    // process restart now cost one SET NX, not two revocation reads first.
    const claimed = await claimOnce(realtimeRedisKey("jti", payload.jti), REPLAY_TTL_SECONDS);
    if (!claimed) return null;

    // Any Redis outage is treated as revoked in production (fail closed).
    const [sessionRevoked, subjectRevokedBefore] = await Promise.all([
      isRevoked(realtimeRedisKey("sid", payload.sid)),
      getRevocationCutoff(realtimeRedisKey("sub", payload.sub)),
    ]);
    if (
      sessionRevoked ||
      (subjectRevokedBefore !== null && payload.iat <= subjectRevokedBefore)
    ) return null;

    // The ticket identifies a Supabase account. Resolve the server-owned
    // competitor mapping and never accept a competitor id from the client.
    const profile = await prisma.accountProfile.findUnique({
      where: { authUserId: payload.sub },
      select: {
        competitorId: true,
        username: true,
        competitor: { select: { status: true } },
      },
    });
    if (!profile || profile.competitor.status !== CompetitorStatus.ACTIVE) return null;

    return {
      id: profile.competitorId,
      username: profile.username,
      authUserId: payload.sub,
      sessionId: payload.sid,
      ticketIssuedAt: payload.iat,
      revocationCheckedAt: Date.now(),
    };
  } catch {
    // Invalid and expired tickets are expected untrusted input. Do not log
    // their contents or turn replay floods into an observability flood.
    return null;
  } finally {
    releaseAdmission();
  }
}

/** Fail startup before Railway reports ready when signing verification is misconfigured. */
export async function validateRealtimeAuthConfig(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    requiredEnv("REALTIME_JWS_ISSUER");
    requiredEnv("REALTIME_JWS_AUDIENCE");
  }
  const keys = readPublicKeys();
  await Promise.all(Object.keys(keys).map((kid) => publicKeyFor(kid)));
}

function validClaims(payload: Record<string, unknown>): payload is Record<string, unknown> & RealtimeClaims & {
  iat: number;
  nbf: number;
  exp: number;
} {
  return (
    payload.v === 1 &&
    typeof payload.sub === "string" &&
    isUuid(payload.sub) &&
    typeof payload.sid === "string" &&
    payload.sid.length > 0 &&
    payload.sid.length <= 256 &&
    typeof payload.jti === "string" &&
    isUuid(payload.jti) &&
    typeof payload.iat === "number" &&
    typeof payload.nbf === "number" &&
    typeof payload.exp === "number" &&
    payload.exp > payload.iat
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function publicKeyFor(kid: string) {
  const existing = keyCache.get(kid);
  if (existing) return existing;

  const keys = readPublicKeys();
  const pem = keys[kid];
  if (!pem) throw new Error("Unknown realtime ticket key id");

  const imported = importSPKI(pem.replace(/\\n/g, "\n"), "EdDSA");
  keyCache.set(kid, imported);
  return imported;
}

function readPublicKeys(): Record<string, string> {
  const serialized = process.env.REALTIME_JWS_PUBLIC_KEYS;
  if (serialized) {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("REALTIME_JWS_PUBLIC_KEYS must be an object");
    }
    const entries = Object.entries(parsed);
    if (entries.length === 0 || entries.length > 4 || entries.some(([, pem]) => typeof pem !== "string")) {
      throw new Error("REALTIME_JWS_PUBLIC_KEYS is invalid");
    }
    return Object.fromEntries(entries) as Record<string, string>;
  }

  const kid = process.env.REALTIME_JWS_KEY_ID;
  const pem = process.env.REALTIME_JWS_PUBLIC_KEY;
  if (kid && pem) return { [kid]: pem };
  throw new Error("No realtime JWS public key is configured");
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
