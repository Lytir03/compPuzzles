import Link from "next/link";

/**
 * Covers both mistyped URLs and the deliberate `notFound()` calls — the
 * profile page's unknown-username path and the match-detail page's
 * not-yours/nonexistent path both land here.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-16 sm:px-6">
      <section className="game-panel flex w-full flex-col items-center rounded-3xl px-6 py-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-3xl">
          🧩
        </span>
        <p className="eyebrow mt-5">404</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Nothing here</h1>
        <p className="subtle-text mt-2 max-w-sm text-sm font-medium leading-6">
          That page, player, or match doesn’t exist — or isn’t yours to see.
        </p>
        <Link href="/dashboard" className="game-button mt-7 rounded-xl px-6 py-3.5 text-base font-black">
          Back to the game lobby
        </Link>
        <Link href="/leaderboard" className="mt-3 text-sm font-bold text-[var(--brand-strong)] hover:underline">
          See the leaderboard
        </Link>
      </section>
    </main>
  );
}
