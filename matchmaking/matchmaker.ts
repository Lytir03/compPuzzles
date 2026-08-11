// Widening schedule from docs/SPEC.md §5, kept as data (not hardcoded
// per-branch) so it's the one place to tune if these ever need to change.
export const RATING_WIDENING_SCHEDULE = [
  { afterMs: 0, maxDistance: 100 },
  { afterMs: 10_000, maxDistance: 200 },
  { afterMs: 20_000, maxDistance: 350 },
  { afterMs: 30_000, maxDistance: Infinity },
] as const;

export function allowedRatingDistance(waitMs: number): number {
  let distance: number = RATING_WIDENING_SCHEDULE[0].maxDistance;
  for (const step of RATING_WIDENING_SCHEDULE) {
    if (waitMs < step.afterMs) break;
    distance = step.maxDistance;
  }
  return distance;
}

export interface QueueCandidate {
  id: string;
  userId: string;
  rating: number;
  queuedAt: Date;
}

export interface MatchPair {
  a: QueueCandidate;
  b: QueueCandidate;
}

/**
 * Greedy pairing: oldest-queued entries get first pick, each matched to
 * its closest-rating still-unpaired candidate within the allowed distance.
 * The allowed distance for a pair uses whichever of the two has waited
 * longer — the longer someone's waited, the more willing they should be.
 * Pure and DB-free by design so it's directly unit-testable (CLAUDE.md
 * calls out "matchmaking rules" explicitly); the caller is responsible for
 * doing the actual DB reads/writes race-condition-safely.
 */
export function findPairs(candidates: QueueCandidate[], now: Date): MatchPair[] {
  const queue = [...candidates].sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime());
  const paired = new Set<string>();
  const pairs: MatchPair[] = [];

  for (const entry of queue) {
    if (paired.has(entry.id)) continue;

    let best: QueueCandidate | null = null;
    let bestDistance = Infinity;

    for (const candidate of queue) {
      if (candidate.id === entry.id || paired.has(candidate.id)) continue;

      const waitMs = Math.max(
        now.getTime() - entry.queuedAt.getTime(),
        now.getTime() - candidate.queuedAt.getTime(),
      );
      const distance = Math.abs(entry.rating - candidate.rating);
      if (distance <= allowedRatingDistance(waitMs) && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    if (best) {
      pairs.push({ a: entry, b: best });
      paired.add(entry.id);
      paired.add(best.id);
    }
  }

  return pairs;
}
