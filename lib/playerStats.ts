/**
 * Pure profile/leaderboard arithmetic, kept out of the page components so it
 * can be unit-tested without a database or a renderer.
 */

export function winRate(wins: number, gamesPlayed: number): number {
  if (gamesPlayed <= 0) return 0;
  return Math.round((wins / gamesPlayed) * 100);
}

/** Mean of the completed solves, ignoring matches that were never finished. */
export function averageCompletionMs(times: (number | null)[]): number | null {
  const completed = times.filter((t): t is number => t !== null && Number.isFinite(t) && t >= 0);
  if (completed.length === 0) return null;
  return Math.round(completed.reduce((sum, t) => sum + t, 0) / completed.length);
}

/** Fastest completed solve, or null if the player has never finished one. */
export function bestCompletionMs(times: (number | null)[]): number | null {
  const completed = times.filter((t): t is number => t !== null && Number.isFinite(t) && t >= 0);
  if (completed.length === 0) return null;
  return Math.min(...completed);
}

export type FormResult = "WIN" | "LOSS" | "DRAW" | "ABANDONED";

/**
 * Recent-form streak: how many matches back the current run of identical
 * outcomes goes. `results` must be newest-first. ABANDONED counts as a loss,
 * matching how it's rated (rating/glicko2.ts) and displayed.
 */
export function currentStreak(results: FormResult[]): { type: "W" | "L" | "D"; count: number } | null {
  if (results.length === 0) return null;

  const asLetter = (result: FormResult): "W" | "L" | "D" =>
    result === "WIN" ? "W" : result === "DRAW" ? "D" : "L";

  const type = asLetter(results[0]);
  let count = 0;
  for (const result of results) {
    if (asLetter(result) !== type) break;
    count++;
  }
  return { type, count };
}

/** "3 days ago" style labels for match history rows. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.round(months / 12)}y ago`;
}
