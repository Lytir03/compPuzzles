import { loginWithUsername } from "@/auth/login";

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const { error } = await props.searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Enter a username to play</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          No password yet — this build is local-only. Use different usernames
          in different browser sessions to test matches as two players.
        </p>
      </div>
      <form action={loginWithUsername} className="flex w-full flex-col gap-3">
        <input
          name="username"
          placeholder="Username"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_-]+"
          autoFocus
          className="rounded-lg border border-black/10 px-4 py-2 dark:border-white/10 dark:bg-transparent"
        />
        {error && (
          <p className="text-sm text-red-600">
            Username must be 3-20 characters: letters, numbers, - or _.
          </p>
        )}
        <button
          type="submit"
          className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background transition hover:opacity-90"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
