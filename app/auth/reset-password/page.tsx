import { resetPassword } from "@/auth/actions";
import { AuthFooterLink, AuthMessage, AuthPanel, AUTH_INPUT_CLASS } from "@/auth/AuthPanel";
import { getVerifiedAuthContext } from "@/auth/session";
import { hasRecoveryProof } from "@/auth/recoveryProof";
import { TurnstileWidget } from "@/auth/TurnstileWidget";
import { SubmitButton } from "@/components/SubmitButton";

const ERRORS: Record<string, string> = {
  captcha: "Please complete the security check.",
  "invalid-password": "Use at least 12 characters and no more than 72 UTF-8 bytes.",
  "password-mismatch": "The two passwords do not match.",
  "rate-limited": "Too many attempts. Try again later.",
  unavailable: "The password could not be changed. Request a new link if this continues.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "The request could not be completed." : null;
  const context = await getVerifiedAuthContext();
  const hasRecoverySession = await hasRecoveryProof(context?.sessionId ?? null);
  return (
    <AuthPanel eyebrow="Choose a password" title="Set your new password" description="Changing it signs out all existing sessions and ranked connections." footer={<AuthFooterLink href="/auth/forgot-password">Request another reset link</AuthFooterLink>}>
      {!hasRecoverySession ? (
        <div className="mt-7"><AuthMessage message="This reset session is missing or expired. Request a new link." /></div>
      ) : (
        <form action={resetPassword} className="mt-7 flex flex-col gap-3">
          <AuthMessage message={error} />
          <label htmlFor="password" className="text-sm font-extrabold">New password</label>
          <input id="password" name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={AUTH_INPUT_CLASS} />
          <label htmlFor="passwordConfirmation" className="text-sm font-extrabold">Confirm new password</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={AUTH_INPUT_CLASS} />
          <TurnstileWidget action="reset_password" />
          <SubmitButton pendingLabel="Updating…" className="game-button rounded-xl px-4 py-3.5 font-black disabled:opacity-70">Update password</SubmitButton>
        </form>
      )}
    </AuthPanel>
  );
}
