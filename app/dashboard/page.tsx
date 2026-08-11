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
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome back, {user.username}
      </h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
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

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Recent matches</h2>
        {recentMatches.length === 0 ? (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">No matches yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {recentMatches.map((participant) => {
              const opponent = participant.match.participants.find((p) => p.userId !== user.id);
              return (
                <li
                  key={participant.id}
                  className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
                >
                  <span>
                    <span className="font-semibold">{participant.result}</span>{" "}
                    <span className="text-black/60 dark:text-white/60">
                      vs {opponent?.user.username ?? "?"} · {GAME_TITLES[participant.match.gameType]}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
