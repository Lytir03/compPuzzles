import { describe, expect, it } from "vitest";
import { getRankTier } from "./tiers";

describe("getRankTier", () => {
  it("returns Bronze for 0 and just below the Silver floor", () => {
    expect(getRankTier(0).name).toBe("Bronze");
    expect(getRankTier(999).name).toBe("Bronze");
  });

  it("returns Silver at its floor", () => {
    expect(getRankTier(1000).name).toBe("Silver");
  });

  it("starts a new 400-rated player in Bronze", () => {
    expect(getRankTier(400).name).toBe("Bronze");
  });

  it("returns Grandmaster at its floor and far above it", () => {
    expect(getRankTier(2100).name).toBe("Grandmaster");
    expect(getRankTier(9999).name).toBe("Grandmaster");
  });

  it("falls back to Bronze for negative ratings", () => {
    expect(getRankTier(-50).name).toBe("Bronze");
  });
});
