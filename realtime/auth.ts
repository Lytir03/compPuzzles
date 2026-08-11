import { prisma } from "@/database/client";
import type { Socket } from "socket.io";

/**
 * The realtime server (port 4000) and the Next.js app (port 3000) are
 * different origins, and our session cookie is SameSite=Lax — browsers
 * don't reliably send Lax cookies on cross-origin XHR/WebSocket handshake
 * requests (only top-level navigations), so cookie-based auth here would
 * silently fail. Instead the client fetches its own userId server-side via
 * auth/realtimeToken.ts (same-origin, cookie works fine there) and passes
 * it explicitly as the socket handshake's `auth.token`.
 *
 * This is exactly as secure as the cookie itself already is — a raw userId,
 * not a signed token — matching the local-only, non-adversarial posture
 * already noted for auth in CLAUDE.md. Revisit alongside Clerk.
 */
export async function authenticateSocket(socket: Socket) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || token.length === 0) return null;
  return prisma.user.findUnique({ where: { id: token } });
}
