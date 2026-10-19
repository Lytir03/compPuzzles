import "server-only";

import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const TERMS_VERSION = "2026-08-17";
let processEnvironmentValidated = false;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required web runtime variable: ${name}`);
  return value;
}

function exactHttpsOrigin(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.origin !== value) {
    throw new Error(`${name} must be an exact HTTPS origin`);
  }
  return parsed.origin;
}

function randomSecret(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);
  if (Buffer.byteLength(value, "utf8") < 32 || value.includes("replace-with")) {
    throw new Error(`${name} must contain at least 32 random bytes`);
  }
  return value;
}

function isPrivilegedSupabaseKey(value: string): boolean {
  if (/service[_-]?role/i.test(value) || value.startsWith("sb_secret_")) return true;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      role?: unknown;
    };
    return payload.role === "service_role" || payload.role === "supabase_admin";
  } catch {
    return false;
  }
}

/** Fail closed at Netlify function cold start without exposing runtime secrets to the build. */
export function validateWebRuntimeEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (env === process.env && processEnvironmentValidated) return;

  const appOrigin = exactHttpsOrigin(env, "APP_ORIGIN");
  if (exactHttpsOrigin(env, "NEXT_PUBLIC_APP_URL") !== appOrigin) {
    throw new Error("NEXT_PUBLIC_APP_URL must equal APP_ORIGIN");
  }
  exactHttpsOrigin(env, "NEXT_PUBLIC_REALTIME_URL");
  exactHttpsOrigin(env, "REALTIME_INTERNAL_URL");
  const supabaseOrigin = exactHttpsOrigin(env, "SUPABASE_URL");
  if (!/\.supabase\.(?:co|in)$/.test(new URL(supabaseOrigin).hostname)) {
    throw new Error("SUPABASE_URL must be a hosted Supabase origin");
  }
  exactHttpsOrigin(env, "UPSTASH_REDIS_REST_URL");

  const publishableKey = required(env, "SUPABASE_PUBLISHABLE_KEY");
  if (isPrivilegedSupabaseKey(publishableKey)) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY must not be a secret/service-role key");
  }
  required(env, "UPSTASH_REDIS_REST_TOKEN");
  required(env, "TURNSTILE_SECRET_KEY");
  required(env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY");

  const expectedHostname = required(env, "TURNSTILE_EXPECTED_HOSTNAME");
  if (expectedHostname !== new URL(appOrigin).hostname) {
    throw new Error("TURNSTILE_EXPECTED_HOSTNAME must match APP_ORIGIN");
  }
  if (env.TURNSTILE_DEV_BYPASS !== "false" || env.AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT !== "false") {
    throw new Error("Development auth bypasses must be disabled in production");
  }
  if (env.AUTH_REVOCATION_TTL_SECONDS !== "604800") {
    throw new Error("AUTH_REVOCATION_TTL_SECONDS must be 604800");
  }

  const secrets = [
    randomSecret(env, "AUTH_FLOW_HMAC_SECRET"),
    randomSecret(env, "PRACTICE_API_SECRET"),
    randomSecret(env, "REALTIME_REDIS_KEY_SECRET"),
  ];
  if (new Set(secrets).size !== secrets.length) {
    throw new Error("Auth, practice and realtime Redis secrets must be distinct");
  }

  if (required(env, "REALTIME_JWS_ISSUER") !== appOrigin) {
    throw new Error("REALTIME_JWS_ISSUER must equal APP_ORIGIN");
  }
  if (required(env, "REALTIME_JWS_AUDIENCE") !== "comppuzzles-realtime") {
    throw new Error("REALTIME_JWS_AUDIENCE must be comppuzzles-realtime");
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(required(env, "REALTIME_JWS_KEY_ID"))) {
    throw new Error("REALTIME_JWS_KEY_ID has an invalid shape");
  }
  const privatePem = required(env, "REALTIME_JWS_PRIVATE_KEY").replace(/\\n/g, "\n");
  const privateKey = createPrivateKey(privatePem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("REALTIME_JWS_PRIVATE_KEY must be an Ed25519 PKCS8 key");
  }
  const challenge = Buffer.from("comppuzzles-realtime-key-check", "utf8");
  if (!verify(null, challenge, createPublicKey(privateKey), sign(null, challenge, privateKey))) {
    throw new Error("REALTIME_JWS_PRIVATE_KEY failed its signing self-test");
  }

  if (required(env, "CURRENT_TERMS_VERSION") !== TERMS_VERSION) {
    throw new Error(`CURRENT_TERMS_VERSION must be ${TERMS_VERSION}`);
  }
  const allowedOrigins = required(env, "ALLOWED_ORIGINS").split(",").map((value) => value.trim());
  if (!allowedOrigins.includes(appOrigin)) throw new Error("ALLOWED_ORIGINS must include APP_ORIGIN");
  for (const origin of allowedOrigins) {
    if (new URL(origin).origin !== origin) throw new Error("ALLOWED_ORIGINS must contain exact origins");
  }

  for (const forbidden of [
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "MIGRATION_DATABASE_URL",
    "BACKUP_DATABASE_URL",
    "RESTORE_DATABASE_URL",
    "AWS_SECRET_ACCESS_KEY",
  ]) {
    if (env[forbidden]) throw new Error(`${forbidden} must not exist in the Netlify runtime`);
  }

  if (env === process.env) processEnvironmentValidated = true;
}
