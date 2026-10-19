import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { AdSlot } from "@/components/ads/AdSlot";
import { GameRatingCard } from "@/components/GameRatingCard";
import { LeaderboardPreview } from "@/components/LeaderboardPreview";
import { GAME_TITLES, MatchHistoryList } from "@/components/MatchHistoryList";
import { GameType } from "@/database/generated/client/enums";
import { fetchStandings } from "@/database/leaderboard";
import { fetchMatchHistory } from "@/database/matchHistory";

const GAME_ORDER: GameType[] = [GameType.SUDOKU, GameType.NONOGRAM];

const PRACTICE_HREFS: Partial<Record<string, string>> = {
  [GameType.SUDOKU]: "/sudoku",
  [GameType.NONOGRAM]: "/nonogram",
};

const RANKED_HREFS: Partial<Record<string, string>> = {
  [GameType.SUDOKU]: "/sudoku/ranked",
  [GameType.NONOGRAM]: "/nonogram/ranked",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const ratingByGame = new Map(user.ratings.map((r) => [r.gameType, r]));

  // Preview the ladder the player actually plays; a Nonogram regular shouldn't
  // land on a Sudoku board they've never entered.
  const mostPlayed = user.ratings
    .filter((r) => GAME_ORDER.includes(r.gameType) && r.gamesPlayed > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
  const previewGame = mostPlayed?.gameType ?? GameType.SUDOKU;

  const [recentMatches, standings] = await Promise.all([
    fetchMatchHistory(user.id, { take: 5 }),
    fetchStandings(previewGame, { take: 5 }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <section className="checker-pattern relative overflow-hidden rounded-3xl bg-[#3d5d31] px-6 py-7 text-white shadow-[0_7px_0_#2b4422] sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#c9e9b0]">Your game lobby</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Ready for the next win, {user.username}?
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium text-white/70 sm:text-base">
              Pick a game, find your match, and keep your streak moving.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 backdrop-blur-sm">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold)] text-xl text-[#4d3808]">⚡</span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/60">Best way to climb</p>
              <p className="text-sm font-black">Play ranked Sudoku</p>
            </div>
          </div>
        </div>
        <span className="absolute -right-12 -top-14 h-44 w-44 rounded-full border-[28px] border-white/5" />
      </section>

      <div className="mt-10 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Choose your arena</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Puzzle games</h2>
        </div>
        <span className="subtle-text hidden text-sm font-bold sm:block">One rating per game</span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {GAME_ORDER.map((gameType) => {
          const rating = ratingByGame.get(gameType);
          if (!rating) return null;
          return (
            <GameRatingCard
              key={gameType}
              title={GAME_TITLES[gameType]}
              rating={rating.rating}
              gamesPlayed={rating.gamesPlayed}
              wins={rating.wins}
              losses={rating.losses}
              practiceHref={PRACTICE_HREFS[gameType]}
              rankedHref={RANKED_HREFS[gameType]}
            />
          );
        })}
        <GameRatingCard title="Minesweeper" practiceHref="/minesweeper" />
      </div>

      <AdSlot
        placement="dashboard-between-games-and-history"
        className="mt-10"
      />

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Your form</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Recent matches</h2>
          </div>
          <Link href="/matches" className="nav-link px-3 py-2 text-sm font-bold">
            Full history →
          </Link>
        </div>
        <MatchHistoryList rows={recentMatches} linkToDetail />
      </section>

      <div className="pb-8">
        <LeaderboardPreview gameType={previewGame} rows={standings} viewerId={user.username} />
      </div>
    </main>
  );
}
