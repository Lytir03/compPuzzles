import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createRecoveryProof, recoveryCookie } from "@/auth/recoveryProof";
import { getCanonicalOrigin } from "@/auth/env";
import { createSupabaseServerClient } from "@/auth/supabase";
import { sanitizeInternalRedirect } from "@/auth/validation";

const OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "recovery",
  "signup",
]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const canonicalOrigin = getCanonicalOrigin();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const recoveryFlow = rawType === "recovery"
    || url.searchParams.get("next")?.startsWith("/auth/reset-password") === true;
  const next = sanitizeInternalRedirect(
    url.searchParams.get("next"),
    recoveryFlow ? "/auth/reset-password" : "/dashboard",
  );
  const supabase = await createSupabaseServerClient({ cookiesWritable: true });

  let error: unknown = null;
  if (code && code.length <= 2_048) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (
    tokenHash
    && tokenHash.length <= 2_048
    && rawType
    && OTP_TYPES.has(rawType as EmailOtpType)
  ) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    }));
  } else {
    error = new Error("Missing callback credential");
  }

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=verification-link-invalid", canonicalOrigin), 303);
  }
  const verified = await supabase.auth.getUser();
  if (verified.error || !verified.data.user?.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/sign-in?error=email-unverified", canonicalOrigin), 303);
  }

  const response = NextResponse.redirect(new URL(next, canonicalOrigin), 303);
  if (recoveryFlow) {
    const claimsResult = await supabase.auth.getClaims();
    const sessionId = claimsResult.data?.claims?.session_id;
    if (typeof sessionId !== "string" || !sessionId) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.redirect(new URL("/auth/forgot-password?error=reset-link-invalid", canonicalOrigin), 303);
    }
    response.cookies.set(recoveryCookie.name, createRecoveryProof(sessionId), {
      domain: undefined,
      httpOnly: true,
      maxAge: recoveryCookie.maxAge,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
