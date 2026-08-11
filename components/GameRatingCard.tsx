import Link from "next/link";
import { RankBadge } from "@/components/RankBadge";

export function GameRatingCard({
  title,
  rating,
  gamesPlayed,
  wins,
  losses,
  practiceHref,
  rankedHref,
}: {
  title: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  practiceHref?: string;
  rankedHref?: string;
}) {
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-6 dark:border-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <RankBadge rating={rating} />
      </div>
      <div className="text-3xl font-bold tabular-nums">{Math.round(rating)}</div>
      <dl className="grid grid-cols-3 gap-2 text-sm text-black/60 dark:text-white/60">
        <div>
          <dt className="text-xs uppercase tracking-wide">Games</dt>
          <dd className="tabular-nums">{gamesPlayed}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">W / L</dt>
          <dd className="tabular-nums">
            {wins} / {losses}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">Win rate</dt>
          <dd className="tabular-nums">{winRate}%</dd>
        </div>
      </dl>
      {rankedHref ? (
        <Link
          href={rankedHref}
          className="mt-2 w-full rounded-lg bg-foreground px-4 py-2 text-center text-sm font-semibold text-background transition hover:opacity-90"
        >
          PLAY RANKED
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title="Ranked matchmaking isn't built for this game yet"
          className="mt-2 w-full cursor-not-allowed rounded-lg bg-black/10 px-4 py-2 text-sm font-semibold text-black/40 dark:bg-white/10 dark:text-white/40"
        >
          PLAY RANKED
        </button>
      )}
      {practiceHref && (
        <Link
          href={practiceHref}
          className="text-center text-sm font-medium hover:underline"
        >
          Practice solo →
        </Link>
      )}
    </div>
  );
}
