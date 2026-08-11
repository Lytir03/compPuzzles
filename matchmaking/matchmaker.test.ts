import { describe, expect, it } from "vitest";
import { allowedRatingDistance, findPairs, type QueueCandidate } from "./matchmaker";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function candidate(
  id: string,
  rating: number,
  waitMs: number,
  overrides: Partial<QueueCandidate> = {},
): QueueCandidate {
  return {
    id,
    userId: `user-${id}`,
    rating,
    queuedAt: new Date(NOW.getTime() - waitMs),
    ...overrides,
  };
}

describe("allowedRatingDistance", () => {
  it("follows the SPEC §5 widening schedule", () => {
    expect(allowedRatingDistance(0)).toBe(100);
    expect(allowedRatingDistance(9_999)).toBe(100);
    expect(allowedRatingDistance(10_000)).toBe(200);
    expect(allowedRatingDistance(19_999)).toBe(200);
    expect(allowedRatingDistance(20_000)).toBe(350);
    expect(allowedRatingDistance(29_999)).toBe(350);
    expect(allowedRatingDistance(30_000)).toBe(Infinity);
    expect(allowedRatingDistance(999_999)).toBe(Infinity);
  });
});

describe("findPairs", () => {
  it("pairs two players within the initial rating window", () => {
    const a = candidate("a", 1500, 1000);
    const b = candidate("b", 1550, 1000);
    const pairs = findPairs([a, b], NOW);
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0].a.id, pairs[0].b.id])).toEqual(new Set(["a", "b"]));
  });

  it("does not pair players outside the allowed distance yet", () => {
    const a = candidate("a", 1500, 1000);
    const b = candidate("b", 1800, 1000); // 300 apart, only 1s waited — needs widening
    expect(findPairs([a, b], NOW)).toHaveLength(0);
  });

  it("pairs distant ratings once enough wait time has widened the window", () => {
    const a = candidate("a", 1500, 25_000);
    const b = candidate("b", 1800, 25_000); // 300 apart, 25s waited -> allowed 350
    expect(findPairs([a, b], NOW)).toHaveLength(1);
  });

  it("prefers the closest-rating candidate over a farther one", () => {
    const a = candidate("a", 1500, 5_000);
    const close = candidate("close", 1520, 5_000);
    const far = candidate("far", 1580, 5_000);
    const pairs = findPairs([a, far, close], NOW);
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0].a.id, pairs[0].b.id])).toEqual(new Set(["a", "close"]));
  });

  it("leaves an odd one out unpaired", () => {
    const a = candidate("a", 1500, 5_000);
    const b = candidate("b", 1510, 5_000);
    const c = candidate("c", 1505, 5_000);
    const pairs = findPairs([a, b, c], NOW);
    expect(pairs).toHaveLength(1);
    const pairedIds = new Set([pairs[0].a.id, pairs[0].b.id]);
    expect(pairedIds.size).toBe(2);
  });

  it("processes the longest-waiting entry first, claiming its pick among equidistant candidates", () => {
    const oldest = candidate("oldest", 1500, 10_000);
    const newer = candidate("newer", 1500, 1_000);
    const newest = candidate("newest", 1500, 500);
    const pairs = findPairs([oldest, newer, newest], NOW);
    expect(pairs).toHaveLength(1);
    // "oldest" is processed first and finds "newer" before "newest" (also
    // equidistant, but later in the oldest-first order), so it claims that
    // pick — leaving "newest" unpaired.
    expect(new Set([pairs[0].a.id, pairs[0].b.id])).toEqual(new Set(["oldest", "newer"]));
  });
});
