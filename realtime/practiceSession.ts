import { isRevoked, realtimeRedisKey } from "./upstash";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Guests have no session; authenticated internal calls must prove a live sid. */
export async function practiceSessionIsActive(
  authUserId: string | null,
  sessionId: string | null,
): Promise<boolean> {
  if (!authUserId) return true;
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return false;
  return !(await isRevoked(realtimeRedisKey("sid", sessionId)));
}
