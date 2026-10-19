const REALTIME_AUDIENCE = "comppuzzles-realtime";

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required in production`);
  return value;
}

function parseUrl(value: string, name: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
}

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

function exactOrigin(value: string, name: string, allowLoopbackHttp: boolean): string {
  const parsed = parseUrl(value, name);
  if (parsed.origin !== value) throw new Error(`${name} must be an exact origin`);
  if (parsed.protocol !== "https:" && !(allowLoopbackHttp && isLoopback(parsed))) {
    throw new Error(`${name} must use HTTPS`);
  }
  return parsed.origin;
}

export function realtimeAppOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.NEXT_PUBLIC_APP_URL?.trim();
  if (value) return value;
  if (env.NODE_ENV === "production") return required(env, "NEXT_PUBLIC_APP_URL");
  return "http://localhost:3000";
}

export function realtimeAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
  appOrigin = realtimeAppOrigin(env),
): string[] {
  const serialized = env.REALTIME_ALLOWED_ORIGINS?.trim();
  if (!serialized) {
    if (env.NODE_ENV === "production") required(env, "REALTIME_ALLOWED_ORIGINS");
    return [appOrigin];
  }
  const origins = serialized.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0 || new Set(origins).size !== origins.length) {
    throw new Error("REALTIME_ALLOWED_ORIGINS must contain unique exact origins");
  }
  for (const origin of origins) {
    const parsed = parseUrl(origin, "REALTIME_ALLOWED_ORIGINS");
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("REALTIME_ALLOWED_ORIGINS must contain exact HTTP(S) origins");
    }
  }
  return origins;
}

/** Validates Railway-only values before readiness is published. */
export function validateRealtimeDeploymentEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const appOrigin = exactOrigin(required(env, "NEXT_PUBLIC_APP_URL"), "NEXT_PUBLIC_APP_URL", false);
  const issuer = exactOrigin(required(env, "REALTIME_JWS_ISSUER"), "REALTIME_JWS_ISSUER", false);
  if (issuer !== appOrigin) throw new Error("REALTIME_JWS_ISSUER must equal NEXT_PUBLIC_APP_URL");
  if (required(env, "REALTIME_JWS_AUDIENCE") !== REALTIME_AUDIENCE) {
    throw new Error(`REALTIME_JWS_AUDIENCE must be ${REALTIME_AUDIENCE}`);
  }

  const origins = realtimeAllowedOrigins(env, appOrigin);
  if (!origins.includes(appOrigin)) {
    throw new Error("REALTIME_ALLOWED_ORIGINS must include NEXT_PUBLIC_APP_URL");
  }
  for (const origin of origins) exactOrigin(origin, "REALTIME_ALLOWED_ORIGINS", false);

  const redisUrl = parseUrl(required(env, "UPSTASH_REDIS_REST_URL"), "UPSTASH_REDIS_REST_URL");
  if (redisUrl.protocol !== "https:" || redisUrl.origin !== redisUrl.href.replace(/\/$/, "")) {
    throw new Error("UPSTASH_REDIS_REST_URL must be an exact HTTPS origin");
  }

  const databaseUrl = parseUrl(required(env, "DATABASE_URL"), "DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (!isLoopback(databaseUrl)) {
    const loginRole = decodeURIComponent(databaseUrl.username).split(".", 1)[0];
    if (loginRole !== "comppuzzles_realtime") {
      throw new Error("DATABASE_URL must use the restricted comppuzzles_realtime role");
    }
    if (databaseUrl.port !== "5432") {
      throw new Error("DATABASE_URL must use the Supavisor session/direct port 5432");
    }
    if (!new Set(["require", "verify-ca", "verify-full"]).has(databaseUrl.searchParams.get("sslmode") ?? "")) {
      throw new Error("DATABASE_URL must require TLS with sslmode");
    }
  }

  const secrets = [
    ["REALTIME_REDIS_KEY_SECRET", required(env, "REALTIME_REDIS_KEY_SECRET")],
    ["PRACTICE_API_SECRET", required(env, "PRACTICE_API_SECRET")],
  ] as const;
  for (const [name, value] of secrets) {
    if (Buffer.byteLength(value, "utf8") < 32 || value.includes("replace-with")) {
      throw new Error(`${name} must contain at least 32 random bytes`);
    }
  }
  if (secrets[0][1] === secrets[1][1]) {
    throw new Error("Realtime Redis and practice API secrets must be distinct");
  }

  const poolMaximum = Number(env.DATABASE_POOL_MAX ?? "5");
  if (!Number.isSafeInteger(poolMaximum) || poolMaximum < 1 || poolMaximum > 5) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 5 for the beta");
  }
}
