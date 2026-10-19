import type { CookieOptions } from "@supabase/ssr";

export const AUTH_COOKIE_NAME = process.env.NODE_ENV === "production"
  ? "__Host-cp-auth"
  : "cp-auth-local";

export function hardenedCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    domain: undefined,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
