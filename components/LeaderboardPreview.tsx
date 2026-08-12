import Link from "next/link";
import { RankBadge } from "@/components/RankBadge";
import type { StandingRow } from "@/database/leaderboard";
import type { GameType } from "@/database/generated/client/enums";
import { GAME_TITLES } from "@/components/MatchHistoryList";

const PODIUM = ["🥇", "🥈", "🥉"];

/**
 * The dashboard's top-of-the-ladder strip, which SPEC §21 asks for by name.
 * The lobby previously had no path to the leaderboard at all in its body.
 */
export function LeaderboardPreview({
  gameType,
  rows,
  viewerId,
}: {
  gameType: GameType;
  rows: StandingRow[];
  viewerId: string;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Top of the ladder</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            {GAME_TITLES[gameType]} leaders
          </h2>
        </div>
        <Link href={`/leaderboard?game=${gameType}`} className="nav-link px-3 py-2 text-sm font-bold">
          Full leaderboard →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="game-panel mt-5 flex flex-col items-center rounded-2xl px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-xl">
            🏁
          </span>
          <p className="mt-3 font-black">The ladder is wide open</p>
          <p className="subtle-text mt-1 text-sm font-medium">
            No ranked {GAME_TITLES[gameType]} results yet — the first win takes first place.
          </p>
        </div>
      ) : (
        <ol className="game-panel mt-5 flex flex-col overflow-hidden rounded-2xl">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 text-sm last:border-b-0 sm:px-5 ${
                row.userId === viewerId ? "bg-[var(--brand-soft)]" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-7 shrink-0 text-center font-black tabular-nums">
                  {PODIUM[index] ?? `#${index + 1}`}
                </span>
                <Link
                  href={`/profile/${encodeURIComponent(row.username)}`}
                  className="truncate font-black hover:text-[var(--brand-strong)] hover:underline"
                >
                  {row.username}
                  {row.userId === viewerId ? " (you)" : ""}
                </Link>
                <span className="hidden sm:inline">
                  <RankBadge rating={row.rating} />
                </span>
              </span>
              <span className="shrink-0 font-black tabular-nums">{Math.round(row.rating)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
