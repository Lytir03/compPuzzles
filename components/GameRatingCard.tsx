import Link from "next/link";
import { RankBadge } from "@/components/RankBadge";

const GAME_META: Record<
  string,
  { mark: string; accent: string; icon: string; description: string }
> = {
  Sudoku: {
    mark: "bg-[#8dc860] text-[#264716] shadow-[0_4px_0_#5b9638]",
    accent: "bg-[#79b74a]",
    icon: "9",
    description: "Classic number races",
  },
  Crosswords: {
    mark: "bg-[#70a9df] text-[#173c62] shadow-[0_4px_0_#427caf]",
    accent: "bg-[#4b91d1]",
    icon: "A",
    description: "Quick word battles",
  },
  Minesweeper: {
    mark: "bg-[#8fc3de] text-[#173d54] shadow-[0_4px_0_#568ba7]",
    accent: "bg-[#6399b5]",
    icon: "✹",
    description: "No-guess minefields",
  },
  Nonograms: {
    mark: "bg-[#f4c45f] text-[#543c08] shadow-[0_4px_0_#c48c29]",
    accent: "bg-[#f2b94b]",
    icon: "▦",
    description: "Picture logic duels",
  },
};

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
  rating?: number;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  practiceHref?: string;
  rankedHref?: string;
}) {
  const hasRating = rating !== undefined;
  const played = gamesPlayed ?? 0;
  const won = wins ?? 0;
  const lost = losses ?? 0;
  const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
  const meta = GAME_META[title] ?? GAME_META.Sudoku;

  return (
    <article className="game-panel group relative flex min-h-[340px] flex-col overflow-hidden rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-1">
      <span className={`absolute inset-x-0 top-0 h-1.5 ${meta.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl text-xl font-black ${meta.mark}`}>
            {meta.icon}
          </span>
          <div>
            <h3 className="text-lg font-black tracking-tight">{title}</h3>
            <p className="subtle-text text-xs font-semibold">{meta.description}</p>
          </div>
        </div>
        {hasRating ? (
          <RankBadge rating={rating} />
        ) : (
          <span className="rounded-full bg-[#dcecf4] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#35657e]">
            New
          </span>
        )}
      </div>
      {hasRating ? (
        <div className="mt-6 flex items-end gap-2">
          <div className="text-4xl font-black tracking-tight tabular-nums">{Math.round(rating)}</div>
          <span className="subtle-text mb-1 text-xs font-bold uppercase tracking-widest">rating</span>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-2xl font-black tracking-tight">Logic, not luck.</p>
          <p className="subtle-text mt-1 text-sm font-semibold leading-5">
            Every board is verified solvable from its opening square.
          </p>
        </div>
      )}
      {hasRating && <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-center">
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--surface)_64%,transparent)] px-1 py-2">
          <dt className="subtle-text text-[10px] font-extrabold uppercase tracking-wide">Games</dt>
          <dd className="mt-0.5 font-black tabular-nums">{played}</dd>
        </div>
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--surface)_64%,transparent)] px-1 py-2">
          <dt className="subtle-text text-[10px] font-extrabold uppercase tracking-wide">W / L</dt>
          <dd className="mt-0.5 font-black tabular-nums">
            {won} / {lost}
          </dd>
        </div>
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--surface)_64%,transparent)] px-1 py-2">
          <dt className="subtle-text text-[10px] font-extrabold uppercase tracking-wide">Win rate</dt>
          <dd className="mt-0.5 font-black tabular-nums">{winRate}%</dd>
        </div>
      </dl>}
      <div className="mt-auto pt-5">
        {rankedHref ? (
          <Link
            href={rankedHref}
            className="game-button block w-full rounded-xl px-4 py-3 text-center text-sm font-black uppercase tracking-wide"
          >
            Play ranked <span aria-hidden="true">⚡</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="Ranked matchmaking isn't built for this game yet"
            className="w-full cursor-not-allowed rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm font-black text-[color-mix(in_srgb,var(--foreground)_38%,transparent)]"
          >
            Ranked coming soon
          </button>
        )}
        {practiceHref && (
          <Link
            href={practiceHref}
            className="mt-3 block text-center text-sm font-bold text-[var(--brand-text)] hover:underline"
          >
            Warm up solo →
          </Link>
        )}
      </div>
    </article>
  );
}
