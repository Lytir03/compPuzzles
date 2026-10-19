import Link from "next/link";
import { redirect } from "next/navigation";
import { changePassword, changeUsername, deleteMyAccount } from "@/auth/actions";
import { AuthMessage, AUTH_INPUT_CLASS } from "@/auth/AuthPanel";
import { getCurrentUser } from "@/auth/currentUser";
import { TurnstileWidget } from "@/auth/TurnstileWidget";
import { SubmitButton } from "@/components/SubmitButton";

const ERRORS: Record<string, string> = {
  captcha: "Please complete the security check.",
  "current-password-invalid": "The current password is incorrect.",
  "delete-confirmation": "Enter your password and type DELETE exactly.",
  "delete-unavailable": "The account could not be deleted. Nothing was removed.",
  "invalid-password": "Use a valid current password and a new password of at least 12 characters.",
  "invalid-username": "Use 3–20 lowercase letters, numbers, dashes, or underscores.",
  "rate-limited": "Too many account changes. Try again later.",
  unavailable: "This account operation is temporarily unavailable.",
  "username-change-unavailable": "The username could not be changed right now.",
  "username-too-soon": "Your username can be changed once every 30 days.",
  "username-unavailable": "That username is unavailable.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "The request could not be completed." : null;
  const notice = params.notice === "username-updated" ? "Your username has been updated." : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Security & privacy</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">Account settings</h1>
          <p className="subtle-text mt-2 font-semibold">Signed in as {user.username}</p>
        </div>
        <Link href="/dashboard" className="soft-button rounded-xl px-4 py-2.5 text-sm font-extrabold">← Dashboard</Link>
      </div>

      <div className="mt-7 space-y-5">
        <AuthMessage message={notice} tone="success" />
        <AuthMessage message={error} />

        <section id="username" className="game-panel scroll-mt-24 rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl font-black">Change username</h2>
          <p className="subtle-text mt-2 text-sm font-semibold">Usernames are lowercase and can be changed at most once every 30 days.</p>
          <form action={changeUsername} className="mt-5 flex max-w-lg flex-col gap-3">
            <label htmlFor="username-input" className="text-sm font-extrabold">New username</label>
            <input id="username-input" name="username" defaultValue={user.username} required minLength={3} maxLength={20} pattern="[a-z0-9_-]+" autoComplete="username" className={AUTH_INPUT_CLASS} />
            <TurnstileWidget action="change_username" />
            <SubmitButton pendingLabel="Saving…" className="game-button rounded-xl px-4 py-3 font-black disabled:opacity-70">Save username</SubmitButton>
          </form>
        </section>

        <section id="password" className="game-panel scroll-mt-24 rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl font-black">Change password</h2>
          <p className="subtle-text mt-2 text-sm font-semibold">This signs out every session and disconnects active ranked games.</p>
          <form action={changePassword} className="mt-5 flex max-w-lg flex-col gap-3">
            <label htmlFor="current-password" className="text-sm font-extrabold">Current password</label>
            <input id="current-password" name="currentPassword" type="password" required maxLength={72} autoComplete="current-password" className={AUTH_INPUT_CLASS} />
            <label htmlFor="new-password" className="text-sm font-extrabold">New password</label>
            <input id="new-password" name="newPassword" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={AUTH_INPUT_CLASS} />
            <label htmlFor="new-password-confirmation" className="text-sm font-extrabold">Confirm new password</label>
            <input id="new-password-confirmation" name="newPasswordConfirmation" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={AUTH_INPUT_CLASS} />
            <TurnstileWidget action="change_password" />
            <SubmitButton pendingLabel="Updating…" className="game-button rounded-xl px-4 py-3 font-black disabled:opacity-70">Update password</SubmitButton>
          </form>
        </section>

        <section className="game-panel rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl font-black">Download your data</h2>
          <p className="subtle-text mt-2 text-sm font-semibold">Export your account, ratings, private match history and retained practice data as JSON.</p>
          <a href="/account/export" className="soft-button mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-extrabold">Download JSON export</a>
        </section>

        <section id="delete" className="scroll-mt-24 rounded-3xl border-2 border-red-300 bg-red-50 p-6 text-red-950 shadow-[0_5px_0_#fecaca] sm:p-8">
          <h2 className="text-xl font-black">Delete account permanently</h2>
          <p className="mt-2 text-sm font-semibold leading-6">Your profile and private attempts are removed immediately. Pseudonymized competitive records remain only to preserve opponent ratings. This cannot be undone.</p>
          <form action={deleteMyAccount} className="mt-5 flex max-w-lg flex-col gap-3">
            <label htmlFor="delete-password" className="text-sm font-extrabold">Current password</label>
            <input id="delete-password" name="password" type="password" required maxLength={72} autoComplete="current-password" className={AUTH_INPUT_CLASS} />
            <label htmlFor="delete-confirmation" className="text-sm font-extrabold">Type DELETE to confirm</label>
            <input id="delete-confirmation" name="confirmation" required maxLength={16} autoComplete="off" className={AUTH_INPUT_CLASS} />
            <TurnstileWidget action="delete_account" />
            <SubmitButton pendingLabel="Deleting…" className="rounded-xl bg-red-700 px-4 py-3 font-black text-white shadow-[0_4px_0_#7f1d1d] disabled:opacity-70">Delete my account</SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
