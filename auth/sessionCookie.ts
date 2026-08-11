// Just the cookie name — no "server-only" import, so this is safe to use
// from both Next.js (auth/session.ts) and the standalone realtime server
// (realtime/auth.ts), which runs as plain Node/tsx outside Next's bundler.
export const SESSION_COOKIE_NAME = "session_user_id";
