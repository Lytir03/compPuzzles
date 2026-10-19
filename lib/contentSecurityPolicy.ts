function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(nonce: string, env: NodeJS.ProcessEnv = process.env): string {
  const realtimeOrigin = safeOrigin(env.NEXT_PUBLIC_REALTIME_URL);
  const websocketOrigin = realtimeOrigin?.replace(/^http/, "ws");
  const connectSources = [
    "'self'",
    realtimeOrigin,
    websocketOrigin,
    safeOrigin(env.NEXT_PUBLIC_SENTRY_DSN),
    safeOrigin(env.NEXT_PUBLIC_SENTRY_TUNNEL_ORIGIN),
    "https://challenges.cloudflare.com",
  ].filter((source): source is string => Boolean(source));
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    `connect-src ${connectSources.join(" ")}`,
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
