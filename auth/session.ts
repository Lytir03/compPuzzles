import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase";

export interface VerifiedAuthContext {
  user: User;
  sessionId: string | null;
}

function readSessionId(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const value = (claims as Record<string, unknown>).session_id;
  return typeof value === "string" && value.length > 0 && value.length <= 128 ? value : null;
}

export function isEmailVerified(user: User): boolean {
  return Boolean(user.email && user.email_confirmed_at);
}

/** Network-verified identity for sensitive operations. */
export async function getVerifiedAuthContext(options: { cookiesWritable?: boolean } = {}): Promise<VerifiedAuthContext | null> {
  const supabase = await createSupabaseServerClient(options);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isEmailVerified(data.user)) return null;

  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims;
  return { user: data.user, sessionId: readSessionId(claims) };
}

/** Compatibility seam for code that needs the authenticated Supabase UUID. */
export async function getSessionUserId(): Promise<string | null> {
  return (await getVerifiedAuthContext())?.user.id ?? null;
}

export async function clearSession(scope: "local" | "global" | "others" = "local") {
  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  await supabase.auth.signOut({ scope });
}
