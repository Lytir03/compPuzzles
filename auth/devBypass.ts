import "server-only";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { requireServerEnv, isProduction, getSupabaseEnv } from "./env";
import { createSupabaseServerClient } from "./supabase";
import { assertSameOrigin } from "./requestSecurity";

const DEV_EMAIL = "dev-bypass@localhost.test";
const DEV_PASSWORD = "dev-bypass-local-only-password-1!";
const DEV_USERNAME = "dev_tester";

export function isDevBypassEnabled(): boolean {
  if (isProduction() || process.env.NODE_ENV !== "development" || process.env.DEV_AUTH_BYPASS !== "true") return false;
  try {
    const url = new URL(getSupabaseEnv().url);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Local-only shortcut: creates (once) and signs in a real, email-confirmed
 * Supabase test account so the app can be exercised without running the
 * verification-email flow. Requires DEV_AUTH_BYPASS=true and a local
 * SUPABASE_SERVICE_ROLE_KEY; both are refused outside development.
 */
export async function devBypassSignIn(): Promise<never> {
  "use server";

  if (!isDevBypassEnabled()) redirect("/sign-in?error=unavailable");
  await assertSameOrigin();

  const env = getSupabaseEnv();
  const serviceRoleKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(env.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();
  const created = await admin.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: DEV_USERNAME,
      username_canonical: DEV_USERNAME,
      terms_version: requireServerEnv("CURRENT_TERMS_VERSION"),
      terms_accepted_at: now,
      age_attested_at: now,
    },
  });

  // Ignore "already registered" — the account was created by a previous call.
  if (created.error && !created.error.message?.toLowerCase().includes("already")) {
    redirect("/sign-in?error=unavailable");
  }

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const { error } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
  if (error) redirect("/sign-in?error=unavailable");
  redirect("/dashboard");
}
