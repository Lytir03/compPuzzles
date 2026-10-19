import { describe, expect, it } from "vitest";
import { INITIAL_RATING } from "./constants";
import { updateRating, updateRatingsForMatch } from "./glicko2";

describe("updateRating", () => {
  // The canonical worked example from Mark Glickman's own Glicko-2 paper
  // ("Example of the Glicko-2 system"): a player rated 1500/RD200/vol0.06
  // plays three opponents in one rating period and beats the first, loses
  // to the other two. Published results: rating≈1464.06, RD≈151.52,
  // volatility≈0.05999. This is the strongest check available for this
  // code — an independently-published reference, not something we derived
  // ourselves — and it exercises the same formulas our single-opponent
  // call sites use (just with n=3 instead of n=1).
  it("reproduces Glickman's published three-opponent worked example", () => {
    const player = { rating: 1500, ratingDeviation: 200, volatility: 0.06 };
    const result = updateRating(player, [
      { rating: 1400, ratingDeviation: 30, score: 1 },
      { rating: 1550, ratingDeviation: 100, score: 0 },
      { rating: 1700, ratingDeviation: 300, score: 0 },
    ]);

    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.ratingDeviation).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });

  it("increases RD (uncertainty) for a player who didn't play", () => {
    const player = { rating: 1500, ratingDeviation: 50, volatility: 0.06 };
    const result = updateRating(player, []);
    expect(result.rating).toBe(1500);
    expect(result.ratingDeviation).toBeGreaterThan(50);
  });
});

describe("updateRatingsForMatch", () => {
  const DEFAULT = { rating: INITIAL_RATING, ratingDeviation: 350, volatility: 0.06 };

  it("raises the winner's rating and lowers the loser's, symmetrically for equal starting players", () => {
    const { a, b } = updateRatingsForMatch(DEFAULT, DEFAULT, "WIN");
    expect(a.rating).toBeGreaterThan(INITIAL_RATING);
    expect(b.rating).toBeLessThan(INITIAL_RATING);
    // Equal starting ratings/RDs -> near-symmetric single-game update.
    expect(a.rating - INITIAL_RATING).toBeCloseTo(INITIAL_RATING - b.rating, 1);
  });

  it("barely changes either rating on a draw between equally-rated players", () => {
    const { a, b } = updateRatingsForMatch(DEFAULT, DEFAULT, "DRAW");
    expect(a.rating).toBeCloseTo(INITIAL_RATING, 0);
    expect(b.rating).toBeCloseTo(INITIAL_RATING, 0);
  });

  it("rewards an upset (beating a much higher-rated opponent) more than beating an easy target", () => {
    const underdog = { rating: 1300, ratingDeviation: 80, volatility: 0.06 };
    const favorite = { rating: 1700, ratingDeviation: 80, volatility: 0.06 };

    const upset = updateRatingsForMatch(underdog, favorite, "WIN");
    const expectedWin = updateRatingsForMatch(favorite, underdog, "WIN");

    const upsetGain = upset.a.rating - underdog.rating;
    const expectedGain = expectedWin.a.rating - favorite.rating;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it("reduces RD after a game for a typical new-player starting deviation", () => {
    const { a, b } = updateRatingsForMatch(DEFAULT, DEFAULT, "WIN");
    expect(a.ratingDeviation).toBeLessThan(350);
    expect(b.ratingDeviation).toBeLessThan(350);
  });

  it("is consistent regardless of argument order (A beating B === B losing to A)", () => {
    const alice = { rating: 1520, ratingDeviation: 120, volatility: 0.06 };
    const bob = { rating: 1480, ratingDeviation: 140, volatility: 0.055 };

    const aliceWins = updateRatingsForMatch(alice, bob, "WIN");
    const bobLoses = updateRatingsForMatch(bob, alice, "LOSS");

    expect(aliceWins.a).toEqual(bobLoses.b);
    expect(aliceWins.b).toEqual(bobLoses.a);
  });
});
