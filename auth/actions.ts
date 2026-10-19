"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCanonicalOrigin, requireServerEnv } from "./env";
import { AuthRateLimitError, enforceAuthRateLimit, type AuthRateLimitName } from "./rateLimit";
import { getClientIp, assertSameOrigin } from "./requestSecurity";
import { consumeRecoveryProof } from "./recoveryProof";
import { markAuthRevoked } from "./redis";
import { requireLogoutRevocation } from "./logoutRevocation";
import { getVerifiedAuthContext, isEmailVerified } from "./session";
import { createSupabaseServerClient } from "./supabase";
import { readTurnstileToken, verifyTurnstile } from "./turnstile";
import {
  AUTH_INPUT_LIMITS,
  isChecked,
  readFormString,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./validation";

type AuthErrorCode =
  | "captcha"
  | "invalid-email"
  | "invalid-password"
  | "invalid-request"
  | "invalid-username"
  | "rate-limited"
  | "unavailable";

async function authFormGuard(
  formData: FormData,
  rule: AuthRateLimitName,
  action: string,
  identifier?: string,
): Promise<AuthErrorCode | null> {
  try {
    await assertSameOrigin();
    const ip = await getClientIp();
    await enforceAuthRateLimit(rule, ip, identifier);
    if (!(await verifyTurnstile(formData, action, ip))) return "captcha";
    return null;
  } catch (error) {
    return error instanceof AuthRateLimitError ? "rate-limited" : "unavailable";
  }
}

/**
 * For Auth endpoints the token is intentionally not verified here: it is
 * passed to Supabase Auth, whose project-level Turnstile check blocks callers
 * that bypass the BFF and invoke the public Auth API directly. Turnstile
 * tokens are single-use, so verifying the same token twice would always fail.
 */
async function supabaseAuthGuard(
  formData: FormData,
  rule: AuthRateLimitName,
  identifier?: string,
): Promise<{ error: AuthErrorCode | null; captchaToken?: string }> {
  try {
    await assertSameOrigin();
    const ip = await getClientIp();
    await enforceAuthRateLimit(rule, ip, identifier);
    const captchaToken = readTurnstileToken(formData);
    if (!captchaToken) {
      if (process.env.NODE_ENV !== "production" && process.env.TURNSTILE_DEV_BYPASS === "true") {
        return { error: null };
      }
      return { error: "captcha" };
    }
    return { error: null, captchaToken };
  } catch (error) {
    return { error: error instanceof AuthRateLimitError ? "rate-limited" : "unavailable" };
  }
}

function authCallbackUrl(next: string): string {
  const url = new URL("/auth/callback", getCanonicalOrigin());
  url.searchParams.set("next", next);
  return url.toString();
}

function isUsernameConflict(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || error.message?.includes("USERNAME_TAKEN") === true;
}

function isCaptchaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || error.message?.toLowerCase().includes("captcha") === true;
}

export async function signUp(formData: FormData): Promise<never> {
  const emailResult = validateEmail(readFormString(formData, "email", AUTH_INPUT_LIMITS.email));
  if (!emailResult.ok) redirect(`/sign-up?error=${emailResult.error}`);
  const passwordResult = validatePassword(readFormString(formData, "password", AUTH_INPUT_LIMITS.password));
  if (!passwordResult.ok) redirect(`/sign-up?error=${passwordResult.error}`);
  const usernameResult = validateUsername(readFormString(formData, "username", AUTH_INPUT_LIMITS.username));
  if (!usernameResult.ok) redirect(`/sign-up?error=${usernameResult.error}`);
  if (!isChecked(formData, "acceptTerms") || !isChecked(formData, "ageAttested")) {
    redirect("/sign-up?error=consent-required");
  }

  const guard = await supabaseAuthGuard(formData, "sign-up", emailResult.value);
  if (guard.error) redirect(`/sign-up?error=${guard.error}`);

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const now = new Date().toISOString();
  const termsVersion = requireServerEnv("CURRENT_TERMS_VERSION");
  const { data, error } = await supabase.auth.signUp({
    email: emailResult.value,
    password: passwordResult.value,
    options: {
      emailRedirectTo: authCallbackUrl("/dashboard"),
      captchaToken: guard.captchaToken,
      data: {
        username: usernameResult.value.username,
        username_canonical: usernameResult.value.canonical,
        terms_version: termsVersion,
        terms_accepted_at: now,
        age_attested_at: now,
      },
    },
  });

  if (data.session) {
    // Production requires email confirmation. If the Supabase project is
    // misconfigured, do not silently create a usable unverified session.
    await supabase.auth.signOut({ scope: "local" });
    redirect("/sign-up?error=verification-misconfigured");
  }
  if (error) {
    const code = isCaptchaError(error)
      ? "captcha"
      : isUsernameConflict(error)
        ? "username-unavailable"
        : "could-not-create";
    redirect(`/sign-up?error=${code}`);
  }
  redirect("/sign-in?notice=check-email");
}

export async function signIn(formData: FormData): Promise<never> {
  const emailResult = validateEmail(readFormString(formData, "email", AUTH_INPUT_LIMITS.email));
  const password = readFormString(formData, "password", AUTH_INPUT_LIMITS.password);
  if (!emailResult.ok || !password) redirect("/sign-in?error=invalid-credentials");

  const guard = await supabaseAuthGuard(formData, "sign-in", emailResult.value);
  if (guard.error) redirect(`/sign-in?error=${guard.error}`);

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailResult.value,
    password,
    options: { captchaToken: guard.captchaToken },
  });
  if (error || !data.user) {
    // Wrong password, unknown address and unverified account intentionally
    // share one response so this endpoint cannot enumerate registrations.
    redirect(`/sign-in?error=${isCaptchaError(error) ? "captcha" : "invalid-credentials"}`);
  }
  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/sign-in?error=invalid-credentials");
  }
  redirect("/dashboard");
}

export async function resendVerification(formData: FormData): Promise<never> {
  const emailResult = validateEmail(readFormString(formData, "email", AUTH_INPUT_LIMITS.email));
  if (!emailResult.ok) redirect("/auth/verify?error=invalid-email");
  const guard = await supabaseAuthGuard(formData, "resend", emailResult.value);
  if (guard.error) redirect(`/auth/verify?error=${guard.error}`);

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  // Always return the same response, including for unknown/confirmed emails.
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: emailResult.value,
    options: {
      emailRedirectTo: authCallbackUrl("/dashboard"),
      captchaToken: guard.captchaToken,
    },
  });
  if (isCaptchaError(error)) redirect("/auth/verify?error=captcha");
  redirect("/auth/verify?notice=sent");
}

export async function requestPasswordReset(formData: FormData): Promise<never> {
  const emailResult = validateEmail(readFormString(formData, "email", AUTH_INPUT_LIMITS.email));
  if (!emailResult.ok) redirect("/auth/forgot-password?error=invalid-email");
  const guard = await supabaseAuthGuard(formData, "forgot", emailResult.value);
  if (guard.error) redirect(`/auth/forgot-password?error=${guard.error}`);

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  // Deliberately ignore provider errors to avoid account enumeration.
  const { error } = await supabase.auth.resetPasswordForEmail(emailResult.value, {
    redirectTo: authCallbackUrl("/auth/reset-password"),
    captchaToken: guard.captchaToken,
  });
  if (isCaptchaError(error)) redirect("/auth/forgot-password?error=captcha");
  redirect("/auth/forgot-password?notice=sent");
}

export async function resetPassword(formData: FormData): Promise<never> {
  const passwordResult = validatePassword(readFormString(formData, "password", AUTH_INPUT_LIMITS.password));
  const confirmation = readFormString(formData, "passwordConfirmation", AUTH_INPUT_LIMITS.password);
  if (!passwordResult.ok || passwordResult.value !== confirmation) {
    redirect(`/auth/reset-password?error=${passwordResult.ok ? "password-mismatch" : "invalid-password"}`);
  }
  const guardError = await authFormGuard(formData, "reset", "reset_password");
  if (guardError) redirect(`/auth/reset-password?error=${guardError}`);

  const context = await getVerifiedAuthContext({ cookiesWritable: true });
  if (!context) redirect("/auth/forgot-password?error=reset-link-invalid");
  if (!(await consumeRecoveryProof(context.sessionId))) {
    redirect("/auth/forgot-password?error=reset-link-invalid");
  }
  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  await markAuthRevoked("sub", context.user.id);
  const { error } = await supabase.auth.updateUser({ password: passwordResult.value });
  if (error) redirect("/auth/reset-password?error=unavailable");

  await supabase.auth.signOut({ scope: "global" });
  redirect("/sign-in?notice=password-updated");
}

export async function changePassword(formData: FormData): Promise<never> {
  const currentPassword = readFormString(formData, "currentPassword", AUTH_INPUT_LIMITS.password);
  const passwordResult = validatePassword(readFormString(formData, "newPassword", AUTH_INPUT_LIMITS.password));
  const confirmation = readFormString(formData, "newPasswordConfirmation", AUTH_INPUT_LIMITS.password);
  if (!currentPassword || !passwordResult.ok || passwordResult.value !== confirmation) {
    redirect("/account?error=invalid-password#password");
  }
  const guard = await supabaseAuthGuard(formData, "account");
  if (guard.error) redirect(`/account?error=${guard.error}#password`);
  const context = await getVerifiedAuthContext({ cookiesWritable: true });
  if (!context?.user.email) redirect("/sign-in");

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const reauth = await supabase.auth.signInWithPassword({
    email: context.user.email,
    password: currentPassword,
    options: { captchaToken: guard.captchaToken },
  });
  if (reauth.error) {
    redirect(`/account?error=${isCaptchaError(reauth.error) ? "captcha" : "current-password-invalid"}#password`);
  }
  await markAuthRevoked("sub", context.user.id);
  const update = await supabase.auth.updateUser({ password: passwordResult.value });
  if (update.error) redirect("/account?error=unavailable#password");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/sign-in?notice=password-updated");
}

export async function changeUsername(formData: FormData): Promise<never> {
  const usernameResult = validateUsername(readFormString(formData, "username", AUTH_INPUT_LIMITS.username));
  if (!usernameResult.ok) redirect(`/account?error=${usernameResult.error}#username`);
  const guardError = await authFormGuard(formData, "account", "change_username", usernameResult.value.canonical);
  if (guardError) redirect(`/account?error=${guardError}#username`);
  if (!(await getVerifiedAuthContext({ cookiesWritable: true }))) redirect("/sign-in");

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const { error } = await supabase
    .schema("api")
    .rpc("change_my_username", { new_username: usernameResult.value.username });
  if (error) {
    const code = isUsernameConflict(error)
      ? "username-unavailable"
      : error.message?.toLowerCase().includes("cannot be changed yet")
        ? "username-too-soon"
        : "username-change-unavailable";
    redirect(`/account?error=${code}#username`);
  }
  revalidatePath("/", "layout");
  redirect("/account?notice=username-updated");
}

/** Returns only the JSON assembled by the user-scoped database RPC. */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const context = await getVerifiedAuthContext({ cookiesWritable: true });
  if (!context) throw new Error("Authentication required");
  const ip = await getClientIp();
  await enforceAuthRateLimit("account", ip, context.user.id);
  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const { data, error } = await supabase.schema("api").rpc("export_my_data");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Account export is unavailable");
  }
  return data as Record<string, unknown>;
}

export async function deleteMyAccount(formData: FormData): Promise<never> {
  const passwordResult = validatePassword(
    readFormString(formData, "password", AUTH_INPUT_LIMITS.password),
  );
  const confirmation = readFormString(formData, "confirmation", 16);
  if (!passwordResult.ok || confirmation !== "DELETE") {
    redirect("/account?error=delete-confirmation#delete");
  }
  const password = passwordResult.value;
  const guard = await supabaseAuthGuard(formData, "account");
  if (guard.error) redirect(`/account?error=${guard.error}#delete`);
  const context = await getVerifiedAuthContext({ cookiesWritable: true });
  if (!context?.user.email) redirect("/sign-in");

  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const reauth = await supabase.auth.signInWithPassword({
    email: context.user.email,
    password,
    options: { captchaToken: guard.captchaToken },
  });
  if (reauth.error) {
    redirect(`/account?error=${isCaptchaError(reauth.error) ? "captcha" : "current-password-invalid"}#delete`);
  }

  // Revoke before destruction. If Redis is down, deletion fails closed rather
  // than leaving an already-authorized realtime socket alive.
  await markAuthRevoked("sub", context.user.id);
  if (context.sessionId) await markAuthRevoked("sid", context.sessionId);
  // signInWithPassword replaced this client's session with a fresh Supabase
  // password-authenticated session. The RPC independently verifies its
  // session_id and password AMR timestamp; no password is sent to PostgREST or
  // compared inside Postgres.
  const { error } = await supabase.schema("api").rpc("delete_my_account");
  if (error) redirect("/account?error=delete-unavailable#delete");
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?notice=account-deleted");
}

export async function signOut(): Promise<never> {
  await assertSameOrigin();
  const context = await getVerifiedAuthContext({ cookiesWritable: true });
  await requireLogoutRevocation(context);
  const supabase = await createSupabaseServerClient({ cookiesWritable: true });
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Secure logout could not be completed");
  redirect("/");
}

// Existing navbar imports keep working while all auth entry points now use
// the same hardened action.
export async function logout(): Promise<never> {
  return signOut();
}
