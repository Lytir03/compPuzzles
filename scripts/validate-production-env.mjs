import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const isNetlifyPreview =
  process.env.NETLIFY === "true" && process.env.CONTEXT !== "production";

const runtimeRequired = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_REALTIME_URL",
  "REALTIME_INTERNAL_URL",
  "APP_ORIGIN",
  "ALLOWED_ORIGINS",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_EXPECTED_HOSTNAME",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "AUTH_FLOW_HMAC_SECRET",
  "PRACTICE_API_SECRET",
  "REALTIME_REDIS_KEY_SECRET",
  "REALTIME_JWS_PRIVATE_KEY",
  "REALTIME_JWS_KEY_ID",
  "REALTIME_JWS_ISSUER",
  "REALTIME_JWS_AUDIENCE",
  "CURRENT_TERMS_VERSION",
];

const publicLaunchRequired = [
  "LEGAL_CONTROLLER_NAME",
  "LEGAL_CONTROLLER_COUNTRY",
  "NEXT_PUBLIC_PRIVACY_EMAIL",
  "NEXT_PUBLIC_SECURITY_EMAIL",
];

const required = isNetlifyPreview
  ? runtimeRequired
  : [...runtimeRequired, ...publicLaunchRequired];

const missing = required.filter((name) => !process.env[name]?.trim());
const errors = [];

if (missing.length > 0) {
  errors.push(`Missing required variables: ${missing.join(", ")}`);
}

for (const name of [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_REALTIME_URL",
  "REALTIME_INTERNAL_URL",
  "APP_ORIGIN",
  "SUPABASE_URL",
  "UPSTASH_REDIS_REST_URL",
]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${name} must use HTTPS.`);
    if (url.origin !== value) errors.push(`${name} must be an exact origin without a path, query or fragment.`);
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
  }
}

try {
  const sentryDsn = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "");
  if (sentryDsn.protocol !== "https:" || !sentryDsn.username || sentryDsn.pathname === "/") {
    errors.push("NEXT_PUBLIC_SENTRY_DSN must be a valid HTTPS project DSN.");
  }
} catch {
  errors.push("NEXT_PUBLIC_SENTRY_DSN must be a valid HTTPS project DSN.");
}

for (const name of ["NEXT_PUBLIC_PRIVACY_EMAIL", "NEXT_PUBLIC_SECURITY_EMAIL"]) {
  const value = process.env[name];
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${name} must be a valid public contact email.`);
  }
}

for (const name of [
  "AUTH_FLOW_HMAC_SECRET",
  "PRACTICE_API_SECRET",
  "REALTIME_REDIS_KEY_SECRET",
]) {
  const value = process.env[name] ?? "";
  if (Buffer.byteLength(value, "utf8") < 32 || value.includes("replace-with")) {
    errors.push(`${name} must contain at least 32 random bytes.`);
  }
}

const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
let privilegedLegacyKey = false;
const jwtParts = publishableKey.split(".");
if (jwtParts.length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(jwtParts[1], "base64url").toString("utf8"));
    privilegedLegacyKey = payload.role === "service_role" || payload.role === "supabase_admin";
  } catch {
    privilegedLegacyKey = false;
  }
}
if (
  /service[_-]?role/i.test(publishableKey)
  || publishableKey.startsWith("sb_secret_")
  || privilegedLegacyKey
) {
  errors.push("SUPABASE_PUBLISHABLE_KEY must not contain a service-role/secret key.");
}

try {
  const appOrigin = new URL(process.env.APP_ORIGIN ?? "").origin;
  const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").origin;
  if (appOrigin !== siteOrigin) errors.push("APP_ORIGIN and NEXT_PUBLIC_SITE_URL must match.");
  const publicAppOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").origin;
  if (publicAppOrigin !== appOrigin) errors.push("NEXT_PUBLIC_APP_URL and APP_ORIGIN must match.");
  const ticketIssuer = new URL(process.env.REALTIME_JWS_ISSUER ?? "").origin;
  if (ticketIssuer !== appOrigin || process.env.REALTIME_JWS_ISSUER !== ticketIssuer) {
    errors.push("REALTIME_JWS_ISSUER must be the exact APP_ORIGIN.");
  }
  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const parsed = new URL(value);
      if (parsed.origin !== value) throw new Error("origin is not exact");
      return parsed.origin;
    });
  if (!allowed.includes(appOrigin)) errors.push("ALLOWED_ORIGINS must include APP_ORIGIN.");
} catch {
  errors.push("ALLOWED_ORIGINS must contain only valid absolute origins.");
}

try {
  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME ?? "";
  const appHostname = new URL(process.env.APP_ORIGIN ?? "").hostname;
  if (expectedHostname !== appHostname) {
    errors.push("TURNSTILE_EXPECTED_HOSTNAME must match the application hostname.");
  }
} catch {
  errors.push("Unable to validate the Turnstile hostname.");
}

if (process.env.TURNSTILE_DEV_BYPASS !== "false") {
  errors.push("TURNSTILE_DEV_BYPASS must be explicitly false outside local development.");
}
if (process.env.AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT !== "false") {
  errors.push("AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT must be explicitly false outside local development.");
}
if (process.env.AUTH_REVOCATION_TTL_SECONDS !== "604800") {
  errors.push("AUTH_REVOCATION_TTL_SECONDS must be 604800 for the beta.");
}

const distinctSecrets = [
  process.env.AUTH_FLOW_HMAC_SECRET,
  process.env.PRACTICE_API_SECRET,
  process.env.REALTIME_REDIS_KEY_SECRET,
].filter(Boolean);
if (new Set(distinctSecrets).size !== distinctSecrets.length) {
  errors.push("Auth-flow, practice and realtime Redis secrets must be distinct.");
}

if (process.env.REALTIME_JWS_AUDIENCE !== "comppuzzles-realtime") {
  errors.push("REALTIME_JWS_AUDIENCE must be comppuzzles-realtime.");
}

try {
  const privateKey = createPrivateKey(
    (process.env.REALTIME_JWS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  );
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("wrong key type");
  const challenge = Buffer.from("comppuzzles-realtime-key-check", "utf8");
  const signature = sign(null, challenge, privateKey);
  if (!verify(null, challenge, createPublicKey(privateKey), signature)) {
    throw new Error("signature self-test failed");
  }
} catch {
  errors.push("REALTIME_JWS_PRIVATE_KEY must be a valid Ed25519 PKCS8 key.");
}

if (process.env.CURRENT_TERMS_VERSION !== "2026-08-17") {
  errors.push("CURRENT_TERMS_VERSION must match the audited database terms version 2026-08-17.");
}

if ((process.env.LEGAL_CONTROLLER_NAME ?? "").includes("[")) {
  errors.push("LEGAL_CONTROLLER_NAME must contain the real controller name.");
}

if (process.env.ADS_PLACEHOLDERS_ENABLED !== "false") {
  errors.push("ADS_PLACEHOLDERS_ENABLED must be false in production.");
}

if (process.env.ADS_ENABLED !== "false") {
  errors.push("ADS_ENABLED must be explicitly false for the public beta.");
}

if (process.env.CSP_ENFORCE !== "true") {
  errors.push("CSP_ENFORCE must be true after the production CSP smoke test.");
}

for (const forbidden of [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "R2_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "BACKUP_DATABASE_URL",
  "RESTORE_DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "REALTIME_DB_PASSWORD",
  "PUZZLE_WRITER_DB_PASSWORD",
  "BACKUP_DB_PASSWORD",
  "BACKUP_AGE_RECIPIENT",
]) {
  if (process.env[forbidden]) {
    errors.push(`${forbidden} must not be available to the Netlify web build/runtime.`);
  }
}

if (errors.length > 0) {
  console.error("Public deployment environment is not safe:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(isNetlifyPreview
  ? "Netlify preview runtime environment checks passed."
  : "Public deployment environment checks passed.");
