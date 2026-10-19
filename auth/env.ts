import "server-only";

/**
 * Auth environment is read lazily so `next build` can render public pages
 * without production credentials. Every sensitive request still fails closed
 * when a required value is absent.
 */
export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getSupabaseEnv(): { url: string; publishableKey: string } {
  return {
    url: requireServerEnv("SUPABASE_URL"),
    // This key is intentionally not a service-role/secret key. Keeping the
    // non-secret publishable key server-side prevents browser code from
    // acquiring or refreshing a Supabase session.
    publishableKey: requireServerEnv("SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function getCanonicalOrigin(): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  if (!isProduction()) return "http://localhost:3000";
  return new URL(requireServerEnv("APP_ORIGIN")).origin;
}

export function getAllowedOrigins(): ReadonlySet<string> {
  const origins = new Set<string>([getCanonicalOrigin()]);
  for (const candidate of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const value = candidate.trim();
    if (value) origins.add(new URL(value).origin);
  }
  return origins;
}
