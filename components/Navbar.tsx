import Link from "next/link";
import { getCurrentUser } from "@/auth/currentUser";
import { logout } from "@/auth/logout";
import { MobileNav } from "@/components/MobileNav";
import { SubmitButton } from "@/components/SubmitButton";

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
              <Link href="/dashboard" className="nav-link hidden px-3 py-2 text-sm font-bold md:block">
                Game lobby
              </Link>
              <Link href="/leaderboard" className="nav-link hidden px-3 py-2 text-sm font-bold md:block">
                Leaderboard
              </Link>
              <Link href="/matches" className="nav-link hidden px-3 py-2 text-sm font-bold md:block">
                History
              </Link>
              {/* The username chip is the profile entry point — it used to be
                  inert text, leaving the profile page unreachable from the nav. */}
              <Link
                href={`/profile/${encodeURIComponent(user.username)}`}
                className="ml-1 flex items-center gap-2 rounded-xl bg-[var(--surface-muted)] px-2 py-1.5 text-sm font-bold transition hover:bg-[var(--brand-soft)] sm:px-2.5"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--gold)] text-xs text-[#513b09]">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-28 truncate sm:inline">{user.username}</span>
              </Link>
              <form action={logout} className="hidden md:block">
                <SubmitButton
                  pendingLabel=""
                  className="nav-link px-3 py-2 text-sm font-bold disabled:opacity-50"
                >
                  Sign out
                </SubmitButton>
              </form>
              <MobileNav username={user.username} />
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
