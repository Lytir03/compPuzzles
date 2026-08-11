import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { GameRatingCard } from "@/components/GameRatingCard";
import { GameType } from "@/database/generated/client/enums";

const GAME_TITLES: Record<string, string> = {
  [GameType.SUDOKU]: "Sudoku",
  [GameType.CROSSWORD]: "Crosswords",
  [GameType.NONOGRAM]: "Nonograms",
};

const GAME_ORDER = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const ratingByGame = new Map(user.ratings.map((r) => [r.gameType, r]));

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
            />
          );
        })}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Recent matches</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          No matches yet — ranked matchmaking arrives in a later phase.
        </p>
      </section>
    </main>
  );
}
