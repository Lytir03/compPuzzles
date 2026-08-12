"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary. Without one, any throw in a server component
 * (a dropped Postgres connection is the realistic case) rendered Next's raw
 * error page — no nav, no way back into the app.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-16 sm:px-6">
      <section className="game-panel flex w-full flex-col items-center rounded-3xl px-6 py-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--coral)]/15 text-3xl">
          ⚠️
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-tight">Something broke</h1>
        <p className="subtle-text mt-2 max-w-sm text-sm font-medium leading-6">
          That page didn’t load. Your ratings and match results are stored server-side, so nothing
          was lost — try again.
        </p>
        {error.digest && (
          <p className="subtle-text mt-3 font-mono text-[11px] font-bold">ref {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="game-button mt-7 w-full rounded-xl px-6 py-3.5 text-base font-black"
        >
          Try again
        </button>
        <Link href="/dashboard" className="mt-3 text-sm font-bold text-[var(--brand-strong)] hover:underline">
          Back to the game lobby
        </Link>
      </section>
    </main>
  );
}
