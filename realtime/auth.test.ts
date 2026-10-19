import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { CompetitorStatus } from "@/database/generated/client/enums";
import type { Socket } from "socket.io";
import { clearAdmissionGuard } from "./admissionGuard";
import { clearLocalStore, realtimeRedisKey, setExpiringValue } from "./upstash";

const AUTH_USER_ID = "9bd44cfb-2c4d-42f6-b4aa-308530c354b4";
const COMPETITOR_ID = "b0f35997-a696-4fc3-9076-549ddf853e1d";
const KID = "test-key";
let profileStatus: CompetitorStatus = CompetitorStatus.ACTIVE;

vi.mock("@/database/client", () => ({
  prisma: {
    accountProfile: {
      findUnique: vi.fn(async ({ where }: { where: { authUserId: string } }) =>
        where.authUserId === AUTH_USER_ID
          ? {
              competitorId: COMPETITOR_ID,
              username: "alice",
              competitor: { status: profileStatus },
            }
          : null,
      ),
    },
  },
}));

const keyPair = await generateKeyPair("EdDSA", { extractable: true });
const { authenticateSocket } = await import("./auth");

beforeAll(async () => {
  process.env.REALTIME_JWS_ISSUER = "https://app.example.test";
  process.env.REALTIME_JWS_AUDIENCE = "comppuzzles-realtime";
  process.env.REALTIME_JWS_KEY_ID = KID;
  process.env.REALTIME_JWS_PUBLIC_KEY = await exportSPKI(keyPair.publicKey);
  vi.stubEnv("REALTIME_REDIS_KEY_SECRET", "realtime-test-secret-with-enough-entropy");
  delete process.env.REALTIME_JWS_PUBLIC_KEYS;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

beforeEach(() => {
  profileStatus = CompetitorStatus.ACTIVE;
  clearLocalStore();
  clearAdmissionGuard();
});

async function ticket(options: { typ?: string; subject?: string; sid?: string } = {}) {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({ sid: options.sid ?? "session-1", v: 1 })
    .setProtectedHeader({ alg: "EdDSA", typ: options.typ ?? "rt+jwt", kid: KID })
    .setIssuer("https://app.example.test")
    .setAudience("comppuzzles-realtime")
    .setSubject(options.subject ?? AUTH_USER_ID)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 1)
    .setExpirationTime(now + 90)
    .sign(keyPair.privateKey);
}

function socketWith(value: string): Socket {
  return { handshake: { auth: { ticket: value }, address: "test-transport" } } as unknown as Socket;
}

describe("authenticateSocket", () => {
  it("maps a verified auth subject to its active competitor", async () => {
    await expect(authenticateSocket(socketWith(await ticket()))).resolves.toEqual({
      id: COMPETITOR_ID,
      username: "alice",
      authUserId: AUTH_USER_ID,
      sessionId: "session-1",
      ticketIssuedAt: expect.any(Number),
      revocationCheckedAt: expect.any(Number),
    });
  });

  it("rejects replay of the same one-time ticket", async () => {
    const value = await ticket();
    expect(await authenticateSocket(socketWith(value))).not.toBeNull();
    // Simulate a process restart: Redis JTI consumption remains the durable
    // replay backstop even after the bounded local admission cache is gone.
    clearAdmissionGuard();
    expect(await authenticateSocket(socketWith(value))).toBeNull();
  });

  it("rejects the wrong token type and an inactive competitor", async () => {
    expect(await authenticateSocket(socketWith(await ticket({ typ: "JWT" })))).toBeNull();
    profileStatus = CompetitorStatus.DELETED;
    expect(await authenticateSocket(socketWith(await ticket()))).toBeNull();
  });

  it("rejects session and account revocation markers", async () => {
    await setExpiringValue(realtimeRedisKey("sid", "revoked-session"), "1", 60_000);
    expect(
      await authenticateSocket(socketWith(await ticket({ sid: "revoked-session" }))),
    ).toBeNull();

    clearLocalStore();
    await setExpiringValue(
      realtimeRedisKey("sub", AUTH_USER_ID),
      String(Math.floor(Date.now() / 1_000)),
      60_000,
    );
    expect(await authenticateSocket(socketWith(await ticket()))).toBeNull();

    clearLocalStore();
    await setExpiringValue(
      realtimeRedisKey("sub", AUTH_USER_ID),
      String(Math.floor(Date.now() / 1_000) - 10),
      60_000,
    );
    expect(await authenticateSocket(socketWith(await ticket()))).not.toBeNull();
  });

  it("never accepts an auth UUID without an account mapping", async () => {
    expect(await authenticateSocket(socketWith(await ticket({ subject: randomUUID() })))).toBeNull();
  });
});
