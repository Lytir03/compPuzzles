import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { AdSlot } from "@/components/ads/AdSlot";
import { GAME_TITLES, MatchHistoryList } from "@/components/MatchHistoryList";
import { RankBadge } from "@/components/RankBadge";
import { GameType } from "@/database/generated/client/enums";
import { fetchPublicPlayer } from "@/database/leaderboard";
import { fetchCompletionTimes, fetchMatchHistory } from "@/database/matchHistory";
import { formatElapsed } from "@/lib/formatElapsed";
import {
  averageCompletionMs,
  bestCompletionMs,
  currentStreak,
  winRate,
  type FormResult,
} from "@/lib/playerStats";

const GAME_ORDER: GameType[] = [GameType.SUDOKU, GameType.NONOGRAM];

const RANKED_HREFS: Record<string, string> = {
  [GameType.SUDOKU]: "/sudoku/ranked",
  [GameType.NONOGRAM]: "/nonogram/ranked",
};

export default async function ProfilePage(props: PageProps<"/profile/[username]">) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/sign-in");

  const { username } = await props.params;

  const player = await fetchPublicPlayer(username);
  if (!player) notFound();

  const isSelf = player.isViewer || player.username === viewer.username;
  const ratingByGame = new Map(player.ratings.map((r) => [r.gameType, r]));

  // Completion times per game, plus recent matches, in one round of queries.
  const [completionTimes, recentMatches] = isSelf
    ? await Promise.all([
        Promise.all(GAME_ORDER.map((gameType) => fetchCompletionTimes(viewer.id, gameType))),
        fetchMatchHistory(viewer.id, { take: 8 }),
      ])
    : [GAME_ORDER.map(() => [] as (number | null)[]), []];

  const streak = currentStreak(
    recentMatches.map((m) => (m.result ?? "DRAW") as FormResult),
  );
  const totalGames = player.ratings.reduce((sum, r) => sum + r.gamesPlayed, 0);
  const totalWins = player.ratings.reduce((sum, r) => sum + r.wins, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <section className="checker-pattern relative overflow-hidden rounded-3xl bg-[#3d5d31] px-6 py-7 text-white shadow-[0_7px_0_#2b4422] sm:px-8">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[var(--gold)] text-2xl font-black text-[#4d3808] sm:h-20 sm:w-20 sm:text-3xl">
              {player.username.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#c9e9b0]">
                {isSelf ? "Your profile" : "Player profile"}
              </p>
              <h1 className="mt-1 truncate text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                {player.username}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/70">
                Joined{" "}
                {player.createdAt.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <HeroStat label="Matches" value={String(totalGames)} />
            <HeroStat label="Win rate" value={`${winRate(totalWins, totalGames)}%`} />
            <HeroStat
              label="Streak"
              value={streak && streak.count > 0 ? `${streak.count}${streak.type}` : "—"}
            />
          </dl>
        </div>
        <span className="absolute -right-12 -top-14 h-44 w-44 rounded-full border-[28px] border-white/5" />
      </section>

      <div className="mt-10">
        <p className="eyebrow">Per-game standing</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Ratings</h2>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {GAME_ORDER.map((gameType, index) => {
          const rating = ratingByGame.get(gameType);
          if (!rating) return null;
          const times = completionTimes[index];
          const average = averageCompletionMs(times);
          const best = bestCompletionMs(times);

          return (
            <article key={gameType} className="game-panel flex flex-col rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black tracking-tight">{GAME_TITLES[gameType]}</h3>
                <RankBadge rating={rating.rating} />
              </div>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black tabular-nums tracking-tight">
                  {Math.round(rating.rating)}
                </span>
                <span className="subtle-text mb-1 text-xs font-bold uppercase tracking-widest">
                  rating
                </span>
              </div>
              <p className="subtle-text mt-1 text-xs font-bold">
                Peak {Math.round(rating.peakRating)} · ±{Math.round(rating.ratingDeviation)} uncertainty
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {/* SPEC §8 lists games-played per game; the record alone
                    doesn't state it, and it's the win rate's denominator. */}
                <Stat label="Games played" value={String(rating.gamesPlayed)} />
                <Stat label="Win rate" value={`${winRate(rating.wins, rating.gamesPlayed)}%`} />
                <Stat label="Record (W–L–D)" value={`${rating.wins}–${rating.losses}–${rating.draws}`} />
                <Stat label="Avg solve" value={average === null ? "—" : formatElapsed(average)} />
                <Stat label="Best solve" value={best === null ? "—" : formatElapsed(best)} wide />
              </dl>

              {isSelf && (
                <Link
                  href={RANKED_HREFS[gameType]}
                  className="game-button mt-5 rounded-xl px-4 py-2.5 text-center text-sm font-black"
                >
                  Play ranked
                </Link>
              )}
            </article>
          );
        })}
      </div>

      <AdSlot placement="profile-after-ratings" className="mt-10" />

      <section className="mt-12 pb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Form</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Recent matches</h2>
          </div>
          {isSelf && (
            <Link href="/matches" className="nav-link px-3 py-2 text-sm font-bold">
              Full history →
            </Link>
          )}
        </div>
        {isSelf ? (
          <MatchHistoryList
            rows={recentMatches}
            linkToDetail
            emptyMessage="Finish a ranked game and your result will appear here."
          />
        ) : (
          <div className="game-panel mt-4 rounded-3xl px-6 py-10 text-center">
            <p className="subtle-text text-sm font-bold">
              Detailed match history, solve times, and mistakes are private.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-2.5 backdrop-blur-sm sm:px-4">
      <dt className="text-[10px] font-extrabold uppercase tracking-widest text-white/60">{label}</dt>
      <dd className="mt-0.5 text-xl font-black tabular-nums sm:text-2xl">{value}</dd>
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-[var(--surface-muted)] px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <dt className="subtle-text text-[10px] font-extrabold uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 font-black tabular-nums">{value}</dd>
    </div>
  );
}
