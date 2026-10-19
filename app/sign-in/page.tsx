import { redirect } from "next/navigation";
import { signIn } from "@/auth/actions";
import { AuthFooterLink, AuthMessage, AuthPanel, AUTH_INPUT_CLASS } from "@/auth/AuthPanel";
import { getCurrentUser } from "@/auth/currentUser";
import { devBypassSignIn, isDevBypassEnabled } from "@/auth/devBypass";
import { TurnstileWidget } from "@/auth/TurnstileWidget";
import { SubmitButton } from "@/components/SubmitButton";

const ERRORS: Record<string, string> = {
  captcha: "Please complete the security check and try again.",
  "email-unverified": "Verify your email before signing in. You can request a new link below.",
  "invalid-credentials": "The email or password is incorrect.",
  "rate-limited": "Too many attempts. Wait a while before trying again.",
  unavailable: "Sign-in is temporarily unavailable. Please try again later.",
  "verification-link-invalid": "That verification link is invalid or expired. Request a new one.",
};
const NOTICES: Record<string, string> = {
  "check-email": "Check your inbox. If the address can be registered, we sent a verification link.",
  "password-updated": "Your password was updated. Sign in again on this device.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "The request could not be completed." : null;
  const notice = typeof params.notice === "string" ? NOTICES[params.notice] ?? null : null;

  return (
    <AuthPanel
      eyebrow="Welcome back"
      title="Sign in to your account"
      description="Use the verified email and password linked to your player profile."
      footer={<>New here? <AuthFooterLink href="/sign-up">Create a free account</AuthFooterLink>.</>}
    >
      <form action={signIn} className="mt-7 flex w-full flex-col gap-3">
        <AuthMessage message={notice} tone="success" />
        <AuthMessage message={error} />
        <label htmlFor="email" className="text-sm font-extrabold">Email</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" autoFocus className={AUTH_INPUT_CLASS} />
        <div className="mt-1 flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-sm font-extrabold">Password</label>
          <AuthFooterLink href="/auth/forgot-password">Forgot password?</AuthFooterLink>
        </div>
        <input id="password" name="password" type="password" required maxLength={72} autoComplete="current-password" className={AUTH_INPUT_CLASS} />
        <TurnstileWidget action="sign_in" />
        <SubmitButton pendingLabel="Signing in…" className="game-button mt-1 rounded-xl px-4 py-3.5 text-base font-black disabled:cursor-wait disabled:opacity-70">
          Sign in →
        </SubmitButton>
        <p className="subtle-text text-center text-sm font-semibold">
          Email not verified? <AuthFooterLink href="/auth/verify">Resend the link</AuthFooterLink>
        </p>
      </form>
      {isDevBypassEnabled() && (
        <form action={devBypassSignIn} className="mt-4 border-t border-dashed border-current/20 pt-4">
          <button type="submit" className="w-full rounded-xl border border-dashed px-4 py-2 text-sm font-bold opacity-80">
            Dev only: skip login
          </button>
        </form>
      )}
    </AuthPanel>
  );
}
