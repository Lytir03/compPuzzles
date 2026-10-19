import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/auth/actions";
import { AuthFooterLink, AuthMessage, AuthPanel, AUTH_INPUT_CLASS } from "@/auth/AuthPanel";
import { getCurrentUser } from "@/auth/currentUser";
import { TurnstileWidget } from "@/auth/TurnstileWidget";
import { SubmitButton } from "@/components/SubmitButton";

const ERRORS: Record<string, string> = {
  captcha: "Please complete the security check and try again.",
  "consent-required": "Accept the Terms and confirm you are at least 16.",
  "could-not-create": "The account could not be created. Check your details or try another username.",
  "invalid-email": "Enter a valid email address.",
  "invalid-password": "Use at least 12 characters and no more than 72 UTF-8 bytes.",
  "invalid-username": "Use 3–20 lowercase letters, numbers, dashes, or underscores.",
  "rate-limited": "Too many registrations. Wait a while before trying again.",
  unavailable: "Registration is temporarily unavailable. Please try again later.",
  "username-unavailable": "That username is unavailable.",
  "verification-misconfigured": "Email verification is temporarily unavailable.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "The request could not be completed." : null;

  return (
    <AuthPanel
      eyebrow="Start competing"
      title="Create your player account"
      description="Your email must be verified before ranked play. Passwords are handled by Supabase Auth and never stored by compPuzzles."
      footer={<>Already registered? <AuthFooterLink href="/sign-in">Sign in</AuthFooterLink>.</>}
    >
      <form action={signUp} className="mt-7 flex w-full flex-col gap-3">
        <AuthMessage message={error} />
        <label htmlFor="username" className="text-sm font-extrabold">Username</label>
        <input id="username" name="username" required minLength={3} maxLength={20} pattern="[a-z0-9_-]+" autoComplete="username" autoFocus className={AUTH_INPUT_CLASS} placeholder="puzzle_master" />
        <label htmlFor="email" className="mt-1 text-sm font-extrabold">Email</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={AUTH_INPUT_CLASS} />
        <label htmlFor="password" className="mt-1 text-sm font-extrabold">Password</label>
        <input id="password" name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={AUTH_INPUT_CLASS} />
        <p className="subtle-text text-xs font-semibold">At least 12 characters; password managers and pasted passwords are welcome.</p>
        <label className="mt-2 flex items-start gap-3 text-sm font-semibold">
          <input name="acceptTerms" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--brand)]" />
          <span>I accept the <Link href="/legal/terms" className="font-extrabold text-[var(--brand-text)] hover:underline">Terms</Link> and acknowledge the <Link href="/legal/privacy" className="font-extrabold text-[var(--brand-text)] hover:underline">Privacy Policy</Link>.</span>
        </label>
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input name="ageAttested" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--brand)]" />
          <span>I confirm that I am at least 16 years old.</span>
        </label>
        <TurnstileWidget action="sign_up" />
        <SubmitButton pendingLabel="Creating account…" className="game-button mt-1 rounded-xl px-4 py-3.5 text-base font-black disabled:cursor-wait disabled:opacity-70">
          Create account →
        </SubmitButton>
      </form>
    </AuthPanel>
  );
}
