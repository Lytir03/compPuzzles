import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";

const VALUE_PROPS = [
  "Ranked matchmaking",
  "Skill ratings",
  "Global leaderboards",
  "Multiple puzzle games",
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-black/50 dark:text-white/50">
        Competitive puzzles
      </p>
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
        Compete. Solve. Climb.
      </h1>
      <p className="max-w-xl text-lg text-black/60 dark:text-white/60">
        Play Sudoku, Crosswords, and Nonograms against real players. Solve
        faster. Win matches. Increase your rating.
      </p>
      <Link
        href="/sign-up"
        className="rounded-lg bg-foreground px-8 py-3 text-base font-semibold text-background transition hover:opacity-90"
      >
        PLAY FREE
      </Link>
      <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-black/50 dark:text-white/50">
        {VALUE_PROPS.map((prop) => (
          <li key={prop}>{prop}</li>
        ))}
      </ul>
    </main>
  );
}
