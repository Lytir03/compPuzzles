import { requestPasswordReset } from "@/auth/actions";
import { AuthFooterLink, AuthMessage, AuthPanel, AUTH_INPUT_CLASS } from "@/auth/AuthPanel";
import { TurnstileWidget } from "@/auth/TurnstileWidget";
import { SubmitButton } from "@/components/SubmitButton";

const ERRORS: Record<string, string> = {
  captcha: "Please complete the security check.",
  "invalid-email": "Enter a valid email address.",
  "rate-limited": "Too many requests. Try again later.",
  "reset-link-invalid": "That reset link is invalid or expired. Request another one.",
  unavailable: "Password recovery is temporarily unavailable.",
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "The request could not be completed." : null;
  const notice = params.notice === "sent" ? "If an account uses that email, a reset link has been sent." : null;
  return (
    <AuthPanel eyebrow="Account recovery" title="Reset your password" description="Enter your email. We never reveal whether an account is registered." footer={<AuthFooterLink href="/sign-in">Back to sign in</AuthFooterLink>}>
      <form action={requestPasswordReset} className="mt-7 flex flex-col gap-3">
        <AuthMessage message={notice} tone="success" />
        <AuthMessage message={error} />
        <label htmlFor="email" className="text-sm font-extrabold">Email</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={AUTH_INPUT_CLASS} />
        <TurnstileWidget action="forgot_password" />
        <SubmitButton pendingLabel="Sending…" className="game-button rounded-xl px-4 py-3.5 font-black disabled:opacity-70">Send reset link</SubmitButton>
      </form>
    </AuthPanel>
  );
}
