/**
 * Shared skeleton primitives for route-level `loading.tsx` files. Every
 * dashboard/leaderboard/profile/history page does DB work in a server
 * component, so without these the browser sits on the previous route with no
 * feedback for the whole query.
 */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl bg-[var(--surface-muted)] ${className}`}
    />
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ul className="game-panel mt-5 flex flex-col overflow-hidden rounded-2xl" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3.5 last:border-b-0 sm:px-5"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1">
              <SkeletonBlock className="h-3.5 w-32 max-w-full rounded-md" />
              <SkeletonBlock className="mt-2 h-3 w-44 max-w-full rounded-md" />
            </span>
          </span>
          <SkeletonBlock className="h-7 w-14 shrink-0 rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Placeholder for the practice/ranked game routes. They all await
 * `getCurrentUser()` in a server component before their client board mounts,
 * so without this the browser holds the previous route for that whole query
 * and only *then* shows the board's own "Joining the arena…" state.
 */
export function GameRouteSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <LoadingAnnouncement label={label} />
      <SkeletonBlock className="mx-auto h-9 w-40 rounded-xl" />
      <SkeletonBlock className="mx-auto mt-6 aspect-square w-[min(96vw,29rem)] rounded-2xl" />
      <SkeletonBlock className="mx-auto mt-5 h-12 w-[min(96vw,34rem)] rounded-xl" />
    </main>
  );
}

/** Announces that a page is loading for assistive tech, which can't see the shimmer. */
export function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}
