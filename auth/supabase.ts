import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, hardenedCookieOptions } from "./cookies";
import { getSupabaseEnv, isProduction } from "./env";
import { validateWebRuntimeEnv } from "./runtimeEnv";

/**
 * Request-scoped Supabase client. It is the only auth client used by the app:
 * no browser client is created, and access/refresh tokens remain HttpOnly.
 */
export async function createSupabaseServerClient(options: { cookiesWritable?: boolean } = {}) {
  validateWebRuntimeEnv();
  const cookieStore = await cookies();
  const env = getSupabaseEnv();

  return createServerClient(env.url, env.publishableKey, {
    cookieOptions: {
      name: AUTH_COOKIE_NAME,
      domain: undefined,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isProduction(),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenedCookieOptions(options));
          }
        } catch {
          // Server Components cannot write cookies. `proxy.ts` performs the
          // refresh/write path; actions and route handlers can write normally.
          if (options.cookiesWritable) throw new Error("Auth cookies could not be updated");
        }
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
}

export { AUTH_COOKIE_NAME } from "./cookies";
