import { describe, expect, it } from "vitest";
import { FLAGGED } from "./engine";
import { solveMinesweeperLogically } from "./solver";

describe("solveMinesweeperLogically", () => {
  it("solves a forced board", () => {
    const result = solveMinesweeperLogically(
      [false, false, false, false, false, false, false, false, true],
      { width: 3, height: 3 },
      1,
      0,
    );

    expect(result.status).toBe("solved");
    expect(result.view[8]).toBe(FLAGGED);
  });

  it("refuses to guess between indistinguishable cells", () => {
    const result = solveMinesweeperLogically(
      [false, true, false, false],
      { width: 2, height: 2 },
      1,
      0,
    );

    expect(result.status).toBe("stalled");
  });
});
