import Link from "next/link";
import type { MatchHistoryRow } from "@/database/matchHistory";
import { GameType } from "@/database/generated/client/enums";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatRelativeTime } from "@/lib/playerStats";

export const GAME_TITLES: Record<string, string> = {
  [GameType.SUDOKU]: "Sudoku",
  [GameType.CROSSWORD]: "Crosswords",
  [GameType.NONOGRAM]: "Nonograms",
};

const DIFFICULTY_LABELS: Record<string, Record<string, string>> = {
  [GameType.SUDOKU]: {
    EASY: "6×6 Challenge",
    MEDIUM: "Easy 9×9",
    HARD: "Hard 9×9",
  },
  [GameType.NONOGRAM]: {
    EASY: "Quick 5×5",
    MEDIUM: "Classic 10×10",
    HARD: "Legacy 15×15",
  },
  [GameType.CROSSWORD]: {
    EASY: "Easy",
    MEDIUM: "Medium",
    HARD: "Hard",
  },
};

export function getDifficultyLabel(gameType: string, difficulty: string): string {
  return DIFFICULTY_LABELS[gameType]?.[difficulty] ?? difficulty;
}

/**
 * Shared match-history rendering for the dashboard, profile, and full history
 * page. Shows what SPEC §20 says every ranked result must be auditable on:
 * opponent, game, difficulty, solve time, rating change, and when it happened.
 */
export function MatchHistoryList({
  rows,
  emptyMessage = "Finish a ranked game and your result will appear here.",
  linkToDetail = false,
}: {
  rows: MatchHistoryRow[];
  emptyMessage?: string;
  /**
   * Links each row to `/matches/[id]`. Off by default because that page is
   * readable only by the match's own participants — on another player's
   * profile the links would all 404.
   */
  linkToDetail?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="game-panel mt-5 flex flex-col items-center rounded-2xl px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-xl">
          🏁
        </span>
        <p className="mt-3 font-black">Your match history starts here</p>
        <p className="subtle-text mt-1 text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="game-panel mt-5 flex flex-col overflow-hidden rounded-2xl">
      {rows.map((row) => {
        const body = (
          <>
            <span className="flex min-w-0 items-center gap-3">
              <ResultChip result={row.result} />
              <span className="min-w-0">
                <span className="block truncate font-black">
                  vs{" "}
                  {linkToDetail || !row.opponentUsername ? (
                    (row.opponentUsername ?? "unknown")
                  ) : (
                    <Link
                      href={`/profile/${encodeURIComponent(row.opponentUsername)}`}
                      className="hover:text-[var(--brand-text)] hover:underline"
                    >
                      {row.opponentUsername}
                    </Link>
                  )}
                </span>
                <span className="subtle-text flex flex-wrap items-center gap-x-2 text-xs font-semibold">
                  <span>{GAME_TITLES[row.gameType]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{getDifficultyLabel(row.gameType, row.difficulty)}</span>
                  {row.completionTimeMs !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      {/* Both times: a 4:58 loss to a 4:56 solve reads very
                          differently from a 4:58 loss to a 2:10, and the
                          opponent's time was already being fetched. */}
                      <span className="font-mono tabular-nums">
                        {formatElapsed(row.completionTimeMs)}
                        {row.opponentCompletionTimeMs !== null && (
                          <span className="opacity-70">
                            {" vs "}
                            {formatElapsed(row.opponentCompletionTimeMs)}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {row.mistakes !== null && row.mistakes > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {row.mistakes} rejected
                      </span>
                    </>
                  )}
                  {row.completedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(row.completedAt)}</span>
                    </>
                  )}
                </span>
              </span>
            </span>
            {row.ratingDelta !== null && (
              <span className="shrink-0 text-right">
                <span
                  className={`block rounded-lg px-2.5 py-1 font-black tabular-nums ${
                    row.ratingDelta >= 0
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                      : "bg-red-500/10 text-red-600"
                  }`}
                >
                  {row.ratingDelta >= 0 ? "+" : ""}
                  {row.ratingDelta}
                </span>
                {row.ratingAfter !== null && (
                  <span className="subtle-text mt-1 block text-[11px] font-bold tabular-nums">
                    {row.ratingAfter}
                  </span>
                )}
              </span>
            )}
          </>
        );

        const rowClass =
          "flex items-center justify-between gap-3 px-4 py-3.5 text-sm sm:gap-4 sm:px-5";

        return (
          <li key={row.id} className="border-b border-[var(--line)] last:border-b-0">
            {linkToDetail ? (
              <Link
                href={`/matches/${row.matchId}`}
                className={`${rowClass} transition hover:bg-[var(--surface-muted)]`}
              >
                {body}
              </Link>
            ) : (
              <span className={rowClass}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ResultChip({ result }: { result: MatchHistoryRow["result"] }) {
  const isWin = result === "WIN";
  const isLoss = result === "LOSS" || result === "ABANDONED";
  return (
    <span
      title={result === "ABANDONED" ? "Lost by disconnect" : undefined}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${
        isWin
          ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
          : isLoss
            ? "bg-red-500/10 text-red-600"
            : "bg-[var(--surface-muted)]"
      }`}
    >
      {isWin ? "W" : isLoss ? "L" : "D"}
    </span>
  );
}
