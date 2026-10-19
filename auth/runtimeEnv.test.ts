import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { validateWebRuntimeEnv } = await import("./runtimeEnv");

const privatePem = generateKeyPairSync("ed25519").privateKey
  .export({ format: "pem", type: "pkcs8" })
  .toString();

function validEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_ORIGIN: "https://play.example.test",
    NEXT_PUBLIC_APP_URL: "https://play.example.test",
    NEXT_PUBLIC_REALTIME_URL: "https://realtime.example.test",
    REALTIME_INTERNAL_URL: "https://realtime.internal.example.test",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
    TURNSTILE_EXPECTED_HOSTNAME: "play.example.test",
    TURNSTILE_DEV_BYPASS: "false",
    AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT: "false",
    AUTH_REVOCATION_TTL_SECONDS: "604800",
    AUTH_FLOW_HMAC_SECRET: "auth-flow-secret-with-at-least-32-random-bytes",
    PRACTICE_API_SECRET: "practice-secret-with-different-32-random-bytes",
    REALTIME_REDIS_KEY_SECRET: "redis-key-secret-with-distinct-32-random-bytes",
    REALTIME_JWS_ISSUER: "https://play.example.test",
    REALTIME_JWS_AUDIENCE: "comppuzzles-realtime",
    REALTIME_JWS_KEY_ID: "production-2026-08",
    REALTIME_JWS_PRIVATE_KEY: privatePem,
    CURRENT_TERMS_VERSION: "2026-08-17",
    ALLOWED_ORIGINS: "https://play.example.test",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("validateWebRuntimeEnv", () => {
  it("accepts a separated, HTTPS-only Netlify runtime", () => {
    expect(() => validateWebRuntimeEnv(validEnv())).not.toThrow();
  });

  it("parses and self-tests the realtime private key", () => {
    expect(() => validateWebRuntimeEnv(validEnv({ REALTIME_JWS_PRIVATE_KEY: "not-a-key" }))).toThrow();
  });

  it("rejects privileged database credentials and shared HMAC secrets", () => {
    expect(() => validateWebRuntimeEnv(validEnv({ DATABASE_URL: "postgresql://owner@db/app" }))).toThrow(
      /must not exist/,
    );
    const reused = "same-secret-with-at-least-32-random-bytes";
    expect(() => validateWebRuntimeEnv(validEnv({
      AUTH_FLOW_HMAC_SECRET: reused,
      PRACTICE_API_SECRET: reused,
    }))).toThrow(/must be distinct/);
  });

  it("rejects legacy JWT service-role keys", () => {
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    expect(() => validateWebRuntimeEnv(validEnv({
      SUPABASE_PUBLISHABLE_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
    }))).toThrow(/service-role/);
  });
});
