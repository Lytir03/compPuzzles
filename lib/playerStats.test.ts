import { describe, expect, it } from "vitest";
import {
  averageCompletionMs,
  bestCompletionMs,
  currentStreak,
  formatRelativeTime,
  winRate,
} from "./playerStats";

describe("winRate", () => {
  it("rounds to a whole percent", () => {
    expect(winRate(1, 3)).toBe(33);
    expect(winRate(2, 3)).toBe(67);
    expect(winRate(5, 5)).toBe(100);
  });

  it("returns 0 rather than NaN for an unplayed game", () => {
    expect(winRate(0, 0)).toBe(0);
    expect(winRate(3, -1)).toBe(0);
  });
});

describe("averageCompletionMs", () => {
  it("averages only completed solves", () => {
    // Nulls are unfinished matches (losses, abandonments) — including them as
    // zeroes would make a player's average time better the more they lose.
    expect(averageCompletionMs([60_000, null, 120_000])).toBe(90_000);
  });

  it("returns null when nothing was ever completed", () => {
    expect(averageCompletionMs([])).toBeNull();
    expect(averageCompletionMs([null, null])).toBeNull();
  });

  it("ignores non-finite and negative values", () => {
    expect(averageCompletionMs([NaN, -5, 30_000])).toBe(30_000);
  });
});

describe("bestCompletionMs", () => {
  it("finds the fastest solve", () => {
    expect(bestCompletionMs([90_000, null, 42_000, 61_000])).toBe(42_000);
  });

  it("returns null with no completions", () => {
    expect(bestCompletionMs([null])).toBeNull();
  });
});

describe("currentStreak", () => {
  it("counts a run of wins from the most recent match", () => {
    expect(currentStreak(["WIN", "WIN", "WIN", "LOSS"])).toEqual({ type: "W", count: 3 });
  });

  it("treats an abandonment as a loss", () => {
    expect(currentStreak(["ABANDONED", "LOSS"])).toEqual({ type: "L", count: 2 });
  });

  it("stops at the first differing outcome", () => {
    expect(currentStreak(["LOSS", "WIN", "WIN"])).toEqual({ type: "L", count: 1 });
  });

  it("handles draws and empty history", () => {
    expect(currentStreak(["DRAW", "DRAW"])).toEqual({ type: "D", count: 2 });
    expect(currentStreak([])).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-11T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("labels each magnitude", () => {
    expect(formatRelativeTime(ago(5_000), now)).toBe("just now");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(formatRelativeTime(ago(4 * 86_400_000), now)).toBe("4d ago");
    expect(formatRelativeTime(ago(90 * 86_400_000), now)).toBe("3mo ago");
    expect(formatRelativeTime(ago(800 * 86_400_000), now)).toBe("2y ago");
  });

  it("clamps clock skew into the past rather than showing a negative age", () => {
    expect(formatRelativeTime(new Date(now.getTime() + 60_000), now)).toBe("just now");
  });
});
