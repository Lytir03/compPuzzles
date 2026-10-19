import { getRevocationCutoff, isRevoked, realtimeRedisKey } from "./upstash";

export interface RealtimeRevocationIdentity {
  authUserId: string;
  sessionId: string;
  ticketIssuedAt: number;
}

/** Shared-store check intended to run on every authoritative mutation. */
export async function realtimeIdentityIsActive(
  identity: RealtimeRevocationIdentity,
): Promise<boolean> {
  const [sessionRevoked, accountRevokedBefore] = await Promise.all([
    isRevoked(realtimeRedisKey("sid", identity.sessionId)),
    getRevocationCutoff(realtimeRedisKey("sub", identity.authUserId)),
  ]);
  return !sessionRevoked
    && (accountRevokedBefore === null || identity.ticketIssuedAt > accountRevokedBefore);
}
