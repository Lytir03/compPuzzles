import { describe, expect, it } from "vitest";
import { realtimeAllowedOrigins, validateRealtimeDeploymentEnv } from "./env";

function productionEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NEXT_PUBLIC_APP_URL: "https://play.example.test",
    REALTIME_ALLOWED_ORIGINS: "https://play.example.test",
    REALTIME_JWS_ISSUER: "https://play.example.test",
    REALTIME_JWS_AUDIENCE: "comppuzzles-realtime",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    DATABASE_URL:
      "postgresql://comppuzzles_realtime.project:secret@aws-0-eu.example.test:5432/postgres?sslmode=require",
    DATABASE_POOL_MAX: "5",
    REALTIME_REDIS_KEY_SECRET: "realtime-redis-secret-with-32-random-bytes",
    PRACTICE_API_SECRET: "practice-api-secret-with-another-32-bytes",
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? "production",
  } as NodeJS.ProcessEnv;
}

describe("validateRealtimeDeploymentEnv", () => {
  it("accepts the restricted TLS production topology", () => {
    expect(() => validateRealtimeDeploymentEnv(productionEnv())).not.toThrow();
  });

  it("rejects owner credentials, insecure origins and secret reuse", () => {
    expect(() => validateRealtimeDeploymentEnv(productionEnv({
      DATABASE_URL: "postgresql://postgres:secret@db.example.test:5432/postgres?sslmode=require",
    }))).toThrow(/restricted comppuzzles_realtime role/);
    expect(() => validateRealtimeDeploymentEnv(productionEnv({
      NEXT_PUBLIC_APP_URL: "http://play.example.test",
    }))).toThrow(/must use HTTPS/);
    expect(() => validateRealtimeDeploymentEnv(productionEnv({
      PRACTICE_API_SECRET: "realtime-redis-secret-with-32-random-bytes",
    }))).toThrow(/must be distinct/);
  });

  it("requires an exact allowlist containing the canonical app origin", () => {
    expect(() => realtimeAllowedOrigins(productionEnv({ REALTIME_ALLOWED_ORIGINS: "" }))).toThrow(
      /REALTIME_ALLOWED_ORIGINS is required/,
    );
    expect(() => validateRealtimeDeploymentEnv(productionEnv({
      REALTIME_ALLOWED_ORIGINS: "https://lookalike.example.test",
    }))).toThrow(/must include NEXT_PUBLIC_APP_URL/);
  });

  it("permits a loopback database for CI while keeping public origins HTTPS", () => {
    expect(() => validateRealtimeDeploymentEnv(productionEnv({
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
    }))).not.toThrow();
  });
});
