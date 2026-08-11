import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { GameRatingCard } from "@/components/GameRatingCard";
import { prisma } from "@/database/client";
import { GameType, MatchStatus } from "@/database/generated/client/enums";

const GAME_TITLES: Record<string, string> = {
  [GameType.SUDOKU]: "Sudoku",
  [GameType.CROSSWORD]: "Crosswords",
  [GameType.NONOGRAM]: "Nonograms",
};

const GAME_ORDER = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];

const PRACTICE_HREFS: Partial<Record<string, string>> = {
  [GameType.SUDOKU]: "/sudoku",
};

const RANKED_HREFS: Partial<Record<string, string>> = {
  [GameType.SUDOKU]: "/sudoku/ranked",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const ratingByGame = new Map(user.ratings.map((r) => [r.gameType, r]));

  const recentMatches = await prisma.matchParticipant.findMany({
    where: { userId: user.id, match: { status: MatchStatus.COMPLETED } },
    orderBy: { match: { completedAt: "desc" } },
    take: 5,
    include: {
      match: { include: { participants: { include: { user: true } } } },
    },
  });

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
      </div>

      <section className="mt-12 pb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Your form</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Recent matches</h2>
          </div>
          <a href="/leaderboard" className="nav-link px-3 py-2 text-sm font-bold">
            View leaderboard →
          </a>
        </div>
        {recentMatches.length === 0 ? (
          <div className="game-panel mt-5 flex flex-col items-center rounded-2xl px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-xl">🏁</span>
            <p className="mt-3 font-black">Your match history starts here</p>
            <p className="subtle-text mt-1 text-sm font-medium">Finish a ranked game and your result will appear here.</p>
          </div>
        ) : (
          <ul className="game-panel mt-5 flex flex-col overflow-hidden rounded-2xl">
            {recentMatches.map((participant) => {
              const opponent = participant.match.participants.find((p) => p.userId !== user.id);
              const delta =
                participant.endingRating !== null
                  ? Math.round(participant.endingRating - participant.startingRating)
                  : null;
              return (
                <li
                  key={participant.id}
                  className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3.5 text-sm last:border-b-0 sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${
                        participant.result === "WIN"
                          ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : participant.result === "LOSS"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-[var(--surface-muted)]"
                      }`}
                    >
                      {participant.result === "WIN" ? "W" : participant.result === "LOSS" ? "L" : "D"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-black">vs {opponent?.user.username ?? "?"}</span>
                      <span className="subtle-text text-xs font-semibold">
                        {GAME_TITLES[participant.match.gameType]}
                      </span>
                    </span>
                  </span>
                  {delta !== null && (
                    <span
                      className={`rounded-lg px-2.5 py-1 font-black tabular-nums ${
                        delta >= 0
                          ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
