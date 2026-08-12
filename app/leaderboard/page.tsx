import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { prisma } from "@/database/client";
import { countRankedPlayers, fetchStandings } from "@/database/leaderboard";
import { GameType } from "@/database/generated/client/enums";
import { RankBadge } from "@/components/RankBadge";
import { winRate } from "@/lib/playerStats";

const GAME_TITLES: Record<string, string> = {
  [GameType.SUDOKU]: "Sudoku",
  [GameType.CROSSWORD]: "Crosswords",
  [GameType.NONOGRAM]: "Nonograms",
};

const GAME_ORDER = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];
const PODIUM = ["🥇", "🥈", "🥉"];
const PAGE_SIZE = 50;

const RANKED_HREFS: Partial<Record<string, string>> = {
  [GameType.SUDOKU]: "/sudoku/ranked",
  [GameType.NONOGRAM]: "/nonogram/ranked",
  [GameType.CROSSWORD]: "/crossword/ranked",
};

function isGameType(value: string | undefined): value is GameType {
  return GAME_ORDER.includes(value as GameType);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const params = await props.searchParams;
  const game = firstParam(params.game);
  const gameType = isGameType(game) ? game : GameType.SUDOKU;

  const requestedPage = Number(firstParam(params.page) ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;

  const [rows, total] = await Promise.all([
    fetchStandings(gameType, { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    countRankedPlayers(gameType),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rankOffset = (page - 1) * PAGE_SIZE;

  const hrefFor = (overrides: { game?: GameType; page?: number }) => {
    const search = new URLSearchParams();
    search.set("game", overrides.game ?? gameType);
    const targetPage = overrides.page ?? page;
    if (targetPage > 1) search.set("page", String(targetPage));
    return `/leaderboard?${search.toString()}`;
  };

  // If the viewer isn't in the visible page, pin their standing below it —
  // otherwise the ladder is useless to exactly the people it should motivate.
  const viewerInPage = rows.some((row) => row.userId === user.id);
  const viewerRow = viewerInPage
    ? null
    : await prisma.playerGameRating.findUnique({
        where: { userId_gameType: { userId: user.id, gameType } },
        include: { user: true },
      });
  const viewerRank =
    viewerRow && viewerRow.gamesPlayed > 0
      ? (await prisma.playerGameRating.count({
          where: { gameType, gamesPlayed: { gt: 0 }, rating: { gt: viewerRow.rating } },
        })) + 1
      : null;

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
            href={hrefFor({ game: g, page: 1 })}
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
                {/* SPEC §7 requires games-played on the board, so it stays
                    visible on a phone; the panel scrolls horizontally instead. */}
                <th className="bg-[var(--surface-muted)] px-2 py-3 sm:px-4">Games</th>
                <th className="rounded-r-xl bg-[var(--surface-muted)] px-3 py-3 sm:px-4">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <LeaderboardRow
                  key={row.id}
                  rank={rankOffset + index + 1}
                  rankLabel={page === 1 ? PODIUM[index] : undefined}
                  username={row.username}
                  rating={row.rating}
                  gamesPlayed={row.gamesPlayed}
                  wins={row.wins}
                  isViewer={row.userId === user.id}
                />
              ))}
              {viewerRow && viewerRank !== null && (
                <>
                  <tr aria-hidden="true">
                    <td colSpan={5} className="subtle-text px-3 py-2 text-center text-xs font-black sm:px-4">
                      ⋯
                    </td>
                  </tr>
                  <LeaderboardRow
                    rank={viewerRank}
                    username={viewerRow.user.username}
                    rating={viewerRow.rating}
                    gamesPlayed={viewerRow.gamesPlayed}
                    wins={viewerRow.wins}
                    isViewer
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Leaderboard pages">
          <PageLink href={hrefFor({ page: page - 1 })} disabled={page <= 1}>
            ← Higher
          </PageLink>
          <span className="subtle-text text-sm font-bold tabular-nums">
            Page {page} of {totalPages}
          </span>
          <PageLink href={hrefFor({ page: page + 1 })} disabled={page >= totalPages}>
            Lower →
          </PageLink>
        </nav>
      )}
    </main>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="subtle-text cursor-not-allowed rounded-xl px-4 py-2.5 text-sm font-extrabold opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="soft-button rounded-xl px-4 py-2.5 text-sm font-extrabold">
      {children}
    </Link>
  );
}

function LeaderboardRow({
  rank,
  rankLabel,
  username,
  rating,
  gamesPlayed,
  wins,
  isViewer,
}: {
  rank: number;
  rankLabel?: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  isViewer: boolean;
}) {
  return (
    <tr
      className={`border-b border-[var(--line)] last:border-b-0 ${
        isViewer ? "bg-[var(--brand-soft)]" : ""
      }`}
    >
      <td className="px-3 py-3.5 font-black tabular-nums sm:px-4">
        <span className="inline-flex min-w-7 items-center justify-center">
          {rankLabel ?? `#${rank}`}
        </span>
      </td>
      <td className="px-3 py-3.5 sm:px-4">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#6fa9df] text-xs font-black text-white">
            {username.slice(0, 1).toUpperCase()}
          </span>
          <Link
            href={`/profile/${encodeURIComponent(username)}`}
            className="max-w-28 truncate font-black hover:text-[var(--brand-strong)] hover:underline sm:max-w-none"
          >
            {username}
            {isViewer ? " (you)" : ""}
          </Link>
          <RankBadge rating={rating} />
        </span>
      </td>
      <td className="px-3 py-3.5 text-base font-black tabular-nums sm:px-4">{Math.round(rating)}</td>
      <td className="subtle-text px-2 py-3.5 font-bold tabular-nums sm:px-4">{gamesPlayed}</td>
      <td className="px-3 py-3.5 font-black tabular-nums sm:px-4">
        <span className="rounded-lg bg-[var(--surface-muted)] px-2 py-1">
          {winRate(wins, gamesPlayed)}%
        </span>
      </td>
    </tr>
  );
}
