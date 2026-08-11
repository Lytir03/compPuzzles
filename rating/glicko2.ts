const SCALE = 173.7178;
const CONVERGENCE_TOLERANCE = 0.000001;

// System constant controlling how much volatility can change per rating
// period. Glickman recommends 0.3-1.2; 0.5 is the common default.
export const TAU = 0.5;

export interface GlickoPlayer {
  rating: number;
  ratingDeviation: number;
  volatility: number;
}

interface ScoredOpponent {
  rating: number;
  ratingDeviation: number;
  /** 1 = win, 0 = loss, 0.5 = draw (from this player's perspective). */
  score: number;
}

function toMu(rating: number): number {
  return (rating - 1500) / SCALE;
}

function toPhi(ratingDeviation: number): number {
  return ratingDeviation / SCALE;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muOpponent: number, phiOpponent: number): number {
  return 1 / (1 + Math.exp(-g(phiOpponent) * (mu - muOpponent)));
}

/**
 * Solves for the new volatility via the Illinois algorithm (a regula falsi
 * variant) — step 5 of Glickman's Glicko-2 specification. There's no
 * closed-form solution; this iterative approach is the standard one.
 */
function computeNewVolatility(delta: number, phi: number, v: number, sigma: number, tau: number): number {
  const a = Math.log(sigma * sigma);
  const deltaSq = delta * delta;
  const phiSq = phi * phi;

  function f(x: number): number {
    const ex = Math.exp(x);
    const numerator = ex * (deltaSq - phiSq - v - ex);
    const denominator = 2 * (phiSq + v + ex) ** 2;
    return numerator / denominator - (x - a) / (tau * tau);
  }

  let A = a;
  let B: number;
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > CONVERGENCE_TOLERANCE) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Core Glicko-2 update for one player across any number of opponents in a
 * rating period. Verified against Glickman's own published worked example
 * in glicko2.test.ts — our actual call sites (updateRatingsForMatch) only
 * ever pass one opponent, since one ranked match is treated as one rating
 * period, but the maths is identical either way, and checking against a
 * real published multi-opponent example is a far stronger guarantee than
 * anything we could invent ourselves for rating-affecting code.
 */
export function updateRating(player: GlickoPlayer, opponents: ScoredOpponent[]): GlickoPlayer {
  if (opponents.length === 0) {
    const phi = toPhi(player.ratingDeviation);
    const phiStar = Math.sqrt(phi * phi + player.volatility * player.volatility);
    return { ...player, ratingDeviation: phiStar * SCALE };
  }

  const mu = toMu(player.rating);
  const phi = toPhi(player.ratingDeviation);

  let vInverseSum = 0;
  let deltaSumTerm = 0;
  for (const opponent of opponents) {
    const muOpponent = toMu(opponent.rating);
    const phiOpponent = toPhi(opponent.ratingDeviation);
    const gPhiOpponent = g(phiOpponent);
    const expected = expectedScore(mu, muOpponent, phiOpponent);
    vInverseSum += gPhiOpponent * gPhiOpponent * expected * (1 - expected);
    deltaSumTerm += gPhiOpponent * (opponent.score - expected);
  }
  const v = 1 / vInverseSum;
  const delta = v * deltaSumTerm;

  const newVolatility = computeNewVolatility(delta, phi, v, player.volatility, TAU);

  const phiStar = Math.sqrt(phi * phi + newVolatility * newVolatility);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSumTerm;

  return {
    rating: newMu * SCALE + 1500,
    ratingDeviation: newPhi * SCALE,
    volatility: newVolatility,
  };
}

export type MatchOutcomeForRating = "WIN" | "LOSS" | "DRAW";

const SCORE_FOR_OUTCOME: Record<MatchOutcomeForRating, number> = {
  WIN: 1,
  LOSS: 0,
  DRAW: 0.5,
};

function opposite(outcome: MatchOutcomeForRating): MatchOutcomeForRating {
  if (outcome === "WIN") return "LOSS";
  if (outcome === "LOSS") return "WIN";
  return "DRAW";
}

/** Convenience wrapper for our actual use case: exactly one opponent (one match). */
export function updateRatingsForMatch(
  playerA: GlickoPlayer,
  playerB: GlickoPlayer,
  outcomeForA: MatchOutcomeForRating,
): { a: GlickoPlayer; b: GlickoPlayer } {
  const outcomeForB = opposite(outcomeForA);

  return {
    a: updateRating(playerA, [
      { rating: playerB.rating, ratingDeviation: playerB.ratingDeviation, score: SCORE_FOR_OUTCOME[outcomeForA] },
    ]),
    b: updateRating(playerB, [
      { rating: playerA.rating, ratingDeviation: playerA.ratingDeviation, score: SCORE_FOR_OUTCOME[outcomeForB] },
    ]),
  };
}
