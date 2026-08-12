// Just names/constants — no "server-only" import, so this is safe to use from
// both Next.js (auth/session.ts) and the standalone realtime server
// (realtime/auth.ts), which runs as plain Node/tsx outside Next's bundler.
export const SESSION_COOKIE_NAME = "session_user_id";

/**
 * Domain separation for lib/signedToken.ts: a realtime handshake token can't
 * be replayed as a session cookie, nor a (much longer-lived) session cookie
 * pasted into a socket handshake.
 */
export const SESSION_TOKEN_PURPOSE = "session";
export const REALTIME_TOKEN_PURPOSE = "realtime";

/**
 * Realtime tokens are short-lived because, unlike the cookie, they're handed
 * to client JS and travel in a WebSocket handshake. Socket.IO only needs the
 * token at connect time (including on automatic reconnects, which reuse the
 * same handshake auth), so this must comfortably outlast a match — a 2-hour
 * window covers any realistic session without being effectively permanent.
 */
export const REALTIME_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
