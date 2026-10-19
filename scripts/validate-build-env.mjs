const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_REALTIME_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "LEGAL_CONTROLLER_NAME",
  "LEGAL_CONTROLLER_COUNTRY",
  "NEXT_PUBLIC_PRIVACY_EMAIL",
  "NEXT_PUBLIC_SECURITY_EMAIL",
];

const errors = [];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) errors.push(`Missing production build variables: ${missing.join(", ")}`);

for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_REALTIME_URL"]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== value) {
      errors.push(`${name} must be an exact HTTPS origin.`);
    }
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
  }
}

if (
  process.env.NEXT_PUBLIC_SITE_URL
  && process.env.NEXT_PUBLIC_APP_URL
  && process.env.NEXT_PUBLIC_SITE_URL !== process.env.NEXT_PUBLIC_APP_URL
) {
  errors.push("NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_APP_URL must match.");
}

for (const name of ["NEXT_PUBLIC_PRIVACY_EMAIL", "NEXT_PUBLIC_SECURITY_EMAIL"]) {
  const value = process.env[name];
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${name} must be a valid public contact email.`);
  }
}

try {
  const dsn = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "");
  if (dsn.protocol !== "https:" || !dsn.username || dsn.pathname === "/") {
    errors.push("NEXT_PUBLIC_SENTRY_DSN must be a valid HTTPS project DSN.");
  }
} catch {
  errors.push("NEXT_PUBLIC_SENTRY_DSN must be a valid HTTPS project DSN.");
}

if ((process.env.LEGAL_CONTROLLER_NAME ?? "").includes("[")) {
  errors.push("LEGAL_CONTROLLER_NAME must contain the real controller name.");
}
if (process.env.ADS_ENABLED !== "false" || process.env.ADS_PLACEHOLDERS_ENABLED !== "false") {
  errors.push("Ads and ad placeholders must remain disabled for the public beta.");
}
if (process.env.CSP_ENFORCE !== "true") {
  errors.push("CSP_ENFORCE must be true after the production CSP smoke test.");
}

// Netlify must scope these to Functions/runtime only. A dependency lifecycle
// or preview build must never receive production credentials.
for (const forbidden of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "TURNSTILE_SECRET_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "AUTH_FLOW_HMAC_SECRET",
  "PRACTICE_API_SECRET",
  "REALTIME_REDIS_KEY_SECRET",
  "REALTIME_JWS_PRIVATE_KEY",
  "SENTRY_DSN",
  "DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "BACKUP_DATABASE_URL",
  "RESTORE_DATABASE_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
]) {
  if (process.env[forbidden]) errors.push(`${forbidden} must not be exposed to the Netlify build scope.`);
}

if (errors.length > 0) {
  console.error("Production build environment is not safe:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production public build environment checks passed.");
