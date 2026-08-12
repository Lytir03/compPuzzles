import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { GAME_TITLES, MatchHistoryList } from "@/components/MatchHistoryList";
import { GameType } from "@/database/generated/client/enums";
import { countMatches, fetchMatchHistory } from "@/database/matchHistory";

const GAME_ORDER = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];
const PAGE_SIZE = 20;

function isGameType(value: string | undefined): value is GameType {
  return GAME_ORDER.includes(value as GameType);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MatchesPage(props: PageProps<"/matches">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const params = await props.searchParams;
  const gameParam = firstParam(params.game);
  const gameType = isGameType(gameParam) ? gameParam : undefined;

  const requestedPage = Number(firstParam(params.page) ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;

  const [rows, total] = await Promise.all([
    fetchMatchHistory(user.id, { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, gameType }),
    countMatches(user.id, gameType),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (overrides: { game?: string; page?: number }) => {
    const search = new URLSearchParams();
    const game = overrides.game ?? gameType;
    if (game) search.set("game", game);
    const targetPage = overrides.page ?? page;
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query ? `/matches?${query}` : "/matches";
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Every ranked result</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">Match history</h1>
          <p className="subtle-text mt-2 text-sm font-medium">
            {total} completed {total === 1 ? "match" : "matches"}
            {gameType ? ` in ${GAME_TITLES[gameType]}` : ""}.
          </p>
        </div>
        <Link href={`/profile/${encodeURIComponent(user.username)}`} className="nav-link px-3 py-2 text-sm font-bold">
          Your profile →
        </Link>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        <FilterTab href={hrefFor({ game: "", page: 1 })} active={!gameType} label="All games" />
        {GAME_ORDER.map((g) => (
          <FilterTab
            key={g}
            href={hrefFor({ game: g, page: 1 })}
            active={g === gameType}
            label={GAME_TITLES[g]}
          />
        ))}
      </div>

      <MatchHistoryList
        rows={rows}
        linkToDetail
        emptyMessage={
          gameType
            ? `No completed ${GAME_TITLES[gameType]} matches yet.`
            : "Finish a ranked game and your result will appear here."
        }
      />

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Match history pages">
          <PageLink href={hrefFor({ page: page - 1 })} disabled={page <= 1}>
            ← Newer
          </PageLink>
          <span className="subtle-text text-sm font-bold tabular-nums">
            Page {page} of {totalPages}
          </span>
          <PageLink href={hrefFor({ page: page + 1 })} disabled={page >= totalPages}>
            Older →
          </PageLink>
        </nav>
      )}
    </main>
  );
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-extrabold transition ${
        active
          ? "border-[#4f8530] bg-[var(--brand)] text-[#1f380f] shadow-[0_3px_0_#4f8530]"
          : "soft-button"
      }`}
    >
      {label}
    </Link>
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
