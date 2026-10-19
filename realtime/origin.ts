/** Socket.IO CORS headers do not protect WebSocket upgrades; allowRequest does. */
export function isAllowedRealtimeOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!origin || !allowedOrigins.includes(origin)) return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && (parsed.protocol === "http:" || parsed.protocol === "https:");
  } catch {
    return false;
  }
}
