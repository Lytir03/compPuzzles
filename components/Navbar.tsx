import Link from "next/link";
import { getCurrentUser } from "@/auth/currentUser";
import { logout } from "@/auth/logout";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] backdrop-blur-xl">
      <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="CompPuzzles home">
          <span className="grid h-9 w-9 grid-cols-2 gap-0.5 rounded-xl bg-[#4d7836] p-1.5 shadow-[0_3px_0_#345624] transition-transform group-hover:-rotate-3">
            <span className="rounded-[3px] bg-[#d9f5c4]" />
            <span className="rounded-[3px] bg-[#8fcb5d]" />
            <span className="rounded-[3px] bg-[#8fcb5d]" />
            <span className="rounded-[3px] bg-[#f6ca65]" />
          </span>
          <span className="text-lg font-black tracking-[-0.04em]">
            Comp<span className="text-[var(--brand-strong)]">Puzzles</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="nav-link px-3 py-2 text-sm font-bold">
                <span className="sm:hidden">Play</span>
                <span className="hidden sm:inline">Game lobby</span>
              </Link>
              <Link href="/leaderboard" className="nav-link hidden px-3 py-2 text-sm font-bold min-[460px]:block">
                Leaderboard
              </Link>
              <span className="ml-1 hidden items-center gap-2 rounded-xl bg-[var(--surface-muted)] px-2.5 py-1.5 text-sm font-bold sm:flex">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--gold)] text-xs text-[#513b09]">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-28 truncate">{user.username}</span>
              </span>
              <form action={logout}>
                <button type="submit" className="nav-link px-3 py-2 text-sm font-bold">
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sm:hidden" aria-label="Sign out">↗</span>
                </button>
              </form>
            </>
          ) : (
            <Link href="/sign-in" className="game-button rounded-xl px-4 py-2 text-sm font-black">
              Play now
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
