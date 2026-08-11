import { loginWithUsername } from "@/auth/login";

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const { error } = await props.searchParams;

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 items-center gap-6 px-6 py-12 md:grid-cols-[0.85fr_1.15fr] md:py-20">
      <section className="checker-pattern hidden h-full min-h-[470px] flex-col justify-between overflow-hidden rounded-3xl bg-[#3e6132] p-8 text-white shadow-[0_7px_0_#2b4422] md:flex">
        <div>
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-[#d2edbd]">
            Player login
          </span>
          <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.04em]">Your next rival is waiting.</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-white/70">
            Sign in, choose a difficulty, and race the same puzzle head-to-head.
          </p>
        </div>
        <div className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gold)] text-lg text-[#4b380c]">🏆</span>
            <div>
              <p className="text-xs font-bold text-white/60">COMPETITIVE PUZZLES</p>
              <p className="font-black">Solve. Win. Climb.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="game-panel rounded-3xl p-6 sm:p-9">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Choose your player name</h1>
          <p className="subtle-text mt-3 text-sm font-medium leading-6">
            This local build uses a username only. Open a second browser session with another
            name to test a live match.
          </p>
        </div>
        <form action={loginWithUsername} className="mt-7 flex w-full flex-col gap-3">
          <label htmlFor="username" className="text-sm font-extrabold">Username</label>
          <input
            id="username"
            name="username"
            placeholder="PuzzleMaster"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_-]+"
            autoComplete="username"
            autoFocus
            className="h-13 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 font-bold outline-none transition placeholder:font-medium placeholder:text-[color-mix(in_srgb,var(--foreground)_35%,transparent)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]"
          />
          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">
              Use 3–20 letters, numbers, dashes, or underscores.
            </p>
          )}
          <button
            type="submit"
            className="game-button mt-2 rounded-xl px-4 py-3.5 text-base font-black"
          >
            Enter the lobby →
          </button>
        </form>
      </section>
    </main>
  );
}
