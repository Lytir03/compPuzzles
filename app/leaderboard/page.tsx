import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { prisma } from "@/database/client";
import { GameType } from "@/database/generated/client/enums";
import { RankBadge } from "@/components/RankBadge";

const GAME_TITLES: Record<string, string> = {
  [GameType.SUDOKU]: "Sudoku",
  [GameType.CROSSWORD]: "Crosswords",
  [GameType.NONOGRAM]: "Nonograms",
};

const GAME_ORDER = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];
const PODIUM = ["🥇", "🥈", "🥉"];

const RANKED_HREFS: Partial<Record<string, string>> = {
  [GameType.SUDOKU]: "/sudoku/ranked",
  [GameType.NONOGRAM]: "/nonogram/ranked",
  [GameType.CROSSWORD]: "/crossword/ranked",
};

function isGameType(value: string | undefined): value is GameType {
  return GAME_ORDER.includes(value as GameType);
}

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { game } = await props.searchParams;
  const gameType = isGameType(Array.isArray(game) ? game[0] : game)
    ? (game as GameType)
    : GameType.SUDOKU;

  const rows = await prisma.playerGameRating.findMany({
    where: { gameType, gamesPlayed: { gt: 0 } },
    orderBy: { rating: "desc" },
    take: 50,
    include: { user: true },
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <section className="checker-pattern relative overflow-hidden rounded-3xl bg-[#344d68] px-6 py-8 text-white shadow-[0_7px_0_#24364b] sm:px-8">
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#bcdaf5]">Global standings</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Chase the top spot.</h1>
          <p className="mt-2 text-sm font-medium text-white/70 sm:text-base">
            Every ranked win counts. Compare ratings and see who rules each puzzle.
          </p>
        </div>
        <span className="absolute -bottom-8 right-7 rotate-12 text-8xl opacity-20" aria-hidden="true">🏆</span>
      </section>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {GAME_ORDER.map((g) => (
          <Link
            key={g}
            href={`/leaderboard?game=${g}`}
            className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-extrabold transition ${
              g === gameType
                ? "border-[#4f8530] bg-[var(--brand)] text-[#1f380f] shadow-[0_3px_0_#4f8530]"
                : "soft-button"
            }`}
          >
            {GAME_TITLES[g]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="game-panel mt-6 flex flex-col items-center rounded-3xl px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-3xl">🏁</span>
          <h2 className="mt-4 text-xl font-black">The ladder is wide open</h2>
          <p className="subtle-text mt-2 max-w-sm text-sm font-medium leading-6">
            No ranked {GAME_TITLES[gameType]} games have been completed yet. The first result gets the first spot.
          </p>
          {RANKED_HREFS[gameType] && (
            <Link
              href={RANKED_HREFS[gameType]!}
              className="game-button mt-6 rounded-xl px-6 py-3 text-sm font-black"
            >
              Play the first match
            </Link>
          )}
        </div>
      ) : (
        <div className="game-panel mt-6 overflow-x-auto rounded-3xl p-2 sm:p-3">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="subtle-text text-[11px] font-extrabold uppercase tracking-wider">
                <th className="rounded-l-xl bg-[var(--surface-muted)] px-3 py-3 sm:px-4">Rank</th>
                <th className="bg-[var(--surface-muted)] px-3 py-3 sm:px-4">Player</th>
                <th className="bg-[var(--surface-muted)] px-3 py-3 sm:px-4">Rating</th>
                <th className="hidden bg-[var(--surface-muted)] px-3 py-3 sm:table-cell sm:px-4">Games</th>
                <th className="rounded-r-xl bg-[var(--surface-muted)] px-3 py-3 sm:px-4">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const winRate =
                  row.gamesPlayed > 0 ? Math.round((row.wins / row.gamesPlayed) * 100) : 0;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[var(--line)] last:border-b-0 ${
                      row.userId === user.id ? "bg-[var(--brand-soft)]" : ""
                    }`}
                  >
                    <td className="px-3 py-3.5 font-black tabular-nums sm:px-4">
                      <span className="inline-flex min-w-7 items-center justify-center">
                        {PODIUM[index] ?? `#${index + 1}`}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 sm:px-4">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#6fa9df] text-xs font-black text-white">
                          {row.user.username.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="max-w-28 truncate font-black sm:max-w-none">
                          {row.user.username}{row.userId === user.id ? " (you)" : ""}
                        </span>
                        <RankBadge rating={row.rating} />
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-base font-black tabular-nums sm:px-4">{Math.round(row.rating)}</td>
                    <td className="subtle-text hidden px-3 py-3.5 font-bold tabular-nums sm:table-cell sm:px-4">{row.gamesPlayed}</td>
                    <td className="px-3 py-3.5 font-black tabular-nums sm:px-4">
                      <span className="rounded-lg bg-[var(--surface-muted)] px-2 py-1">{winRate}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
