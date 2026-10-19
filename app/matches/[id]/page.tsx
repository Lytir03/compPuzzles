import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { RankBadge } from "@/components/RankBadge";
import { GAME_TITLES, getDifficultyLabel } from "@/components/MatchHistoryList";
import { fetchMatchDetail, type MatchDetailSide } from "@/database/matchHistory";
import { formatElapsed } from "@/lib/formatElapsed";

/**
 * SPEC §20 requires every ranked result to be auditable. The history list shows
 * the outcome; this shows the numbers it was computed from — both sides'
 * rating before and after, both solve times, rejected submissions, and the
 * puzzle id the server validated against.
 *
 * The puzzle's *solution* is deliberately never fetched here.
 */
export default async function MatchDetailPage(props: PageProps<"/matches/[id]">) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/sign-in");

  const { id } = await props.params;
  const match = await fetchMatchDetail(id, viewer.id);
  if (!match) notFound();

  const { you, opponent } = match;
  const outcomeLabel =
    you.result === "WIN"
      ? "You won"
      : you.result === "LOSS" || you.result === "ABANDONED"
        ? "You lost"
        : you.result === "DRAW"
          ? "Draw"
          : "Result recorded";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/matches" className="nav-link inline-block px-3 py-2 text-sm font-bold">
        ← Match history
      </Link>

      <section className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {GAME_TITLES[match.gameType]} · {getDifficultyLabel(match.gameType, match.difficulty)}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">{outcomeLabel}</h1>
          <p className="subtle-text mt-2 text-sm font-medium">
            {match.completedAt
              ? match.completedAt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Completion time not recorded"}
            {you.result === "ABANDONED" || opponent?.result === "ABANDONED"
              ? " · decided by disconnect"
              : ""}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SideCard side={you} isViewer isWinner={match.winnerUserId === you.userId} />
        {opponent ? (
          <SideCard
            side={opponent}
            isViewer={false}
            isWinner={match.winnerUserId === opponent.userId}
          />
        ) : (
          <article className="game-panel flex items-center justify-center rounded-3xl p-5">
            <p className="subtle-text text-sm font-bold">No opponent recorded</p>
          </article>
        )}
      </div>

      <section className="game-panel mt-6 rounded-3xl p-5">
        <h2 className="text-sm font-black uppercase tracking-widest">Match record</h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <Fact label="Game" value={GAME_TITLES[match.gameType]} />
          <Fact
            label="Difficulty"
            value={getDifficultyLabel(match.gameType, match.difficulty)}
          />
          <Fact
            label="Boards went live"
            value={
              match.startedAt
                ? match.startedAt.toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  })
                : "—"
            }
          />
          <Fact
            label="Match ended"
            value={
              match.completedAt
                ? match.completedAt.toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  })
                : "—"
            }
          />
          <Fact label="Puzzle" value={match.puzzleId ?? "Purged after 90 days"} mono />
          <Fact label="Match" value={match.id} mono />
        </dl>
        <p className="subtle-text mt-4 text-xs font-medium leading-5">
          The winner and every rating change here were computed on the server from the puzzle above
          — never from a client claiming a win.
        </p>
      </section>
    </main>
  );
}

function SideCard({
  side,
  isViewer,
  isWinner,
}: {
  side: MatchDetailSide;
  isViewer: boolean;
  isWinner: boolean;
}) {
  const delta =
    side.endingRating !== null ? Math.round(side.endingRating - side.startingRating) : null;

  return (
    <article
      className={`game-panel flex flex-col rounded-3xl p-5 ${
        isWinner ? "ring-2 ring-[var(--brand)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="subtle-text text-[10px] font-extrabold uppercase tracking-widest">
            {isViewer ? "You" : "Opponent"}
          </p>
          <Link
            href={`/profile/${encodeURIComponent(side.username)}`}
            className="mt-0.5 block truncate text-lg font-black hover:text-[var(--brand-text)] hover:underline"
          >
            {side.username}
          </Link>
        </div>
        {isWinner && <span className="shrink-0 text-xl" aria-label="Winner">🏆</span>}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-black tabular-nums tracking-tight">
          {side.endingRating !== null ? Math.round(side.endingRating) : "—"}
        </span>
        {delta !== null && (
          <span
            className={`mb-1 rounded-lg px-2 py-0.5 text-sm font-black tabular-nums ${
              delta >= 0
                ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                : "bg-red-500/10 text-red-600"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
      <p className="subtle-text mt-1 text-xs font-bold">
        Was {Math.round(side.startingRating)}
      </p>
      {side.endingRating !== null && (
        <div className="mt-3">
          <RankBadge rating={side.endingRating} />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat
          label="Solve time"
          value={side.completionTimeMs === null ? "—" : formatElapsed(side.completionTimeMs)}
        />
        <Stat label="Rejected" value={String(side.mistakes)} />
      </dl>
      {side.disconnected && (
        <p className="subtle-text mt-3 text-xs font-bold">Disconnected during this match</p>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
      <dt className="subtle-text text-[10px] font-extrabold uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 font-black tabular-nums">{value}</dd>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
      <dt className="subtle-text text-[10px] font-extrabold uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 break-all font-bold ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
