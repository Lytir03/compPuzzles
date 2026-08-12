import { REALTIME_TOKEN_PURPOSE } from "@/auth/sessionCookie";
import { prisma } from "@/database/client";
import { verifySignedToken } from "@/lib/signedToken";
import type { Socket } from "socket.io";

/**
 * The realtime server (port 4000) and the Next.js app (port 3000) are
 * different origins, and our session cookie is SameSite=Lax — browsers
 * don't reliably send Lax cookies on cross-origin XHR/WebSocket handshake
 * requests (only top-level navigations), so cookie-based auth here would
 * silently fail. Instead the client fetches a token server-side via
 * auth/realtimeToken.ts (same-origin, cookie works fine there) and passes it
 * explicitly as the socket handshake's `auth.token`.
 *
 * That token is HMAC-signed and expiring (lib/signedToken.ts). It used to be
 * the raw userId, which was a real hole rather than a stylistic one: userIds
 * are not secret, and server.ts drops any existing socket for a user when a
 * new one connects — so anyone holding a victim's id could connect as them,
 * kick them out of a live ranked match, and let the disconnect grace period
 * hand them a loss and a rating hit. Signing is what makes that impossible;
 * it does not turn the username-only login itself into real auth (Clerk is
 * still the eventual answer per CLAUDE.md).
 */
export async function authenticateSocket(socket: Socket) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || token.length === 0) return null;

  const userId = verifySignedToken(token, REALTIME_TOKEN_PURPOSE);
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}
