import { contentSecurityPolicy } from "@/lib/contentSecurityPolicy";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, hardenedCookieOptions } from "@/auth/cookies";

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith(AUTH_COOKIE_NAME));

  if (hasAuthCookie) {
    const supabase = createServerClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
      cookieOptions: {
        name: AUTH_COOKIE_NAME,
        domain: undefined,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, hardenedCookieOptions(options));
          }
        },
      },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
      },
    });

    // Validates asymmetric JWTs locally and refreshes an expired access token
    // through the HttpOnly cookie adapter when necessary.
    await supabase.auth.getClaims();
  }

  if (hasAuthCookie || request.nextUrl.pathname.startsWith("/auth") || request.nextUrl.pathname.startsWith("/account")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  response.headers.set(
    process.env.CSP_ENFORCE === "true"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    csp,
  );
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
