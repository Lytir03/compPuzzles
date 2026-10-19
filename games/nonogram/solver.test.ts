import { describe, expect, it } from "vitest";
import { FILLED, MARKED_EMPTY } from "./engine";
import { enumerateLinePatterns, solveNonogramLogically } from "./solver";

describe("enumerateLinePatterns", () => {
  it("enumerates separated runs", () => {
    expect(enumerateLinePatterns(4, [1, 2])).toEqual([
      [FILLED, MARKED_EMPTY, FILLED, FILLED],
    ]);
  });

  it("handles an empty clue", () => {
    expect(enumerateLinePatterns(3, [])).toEqual([
      [MARKED_EMPTY, MARKED_EMPTY, MARKED_EMPTY],
    ]);
  });
});

describe("solveNonogramLogically", () => {
  it("solves a small puzzle entirely by forced cells", () => {
    const result = solveNonogramLogically({
      width: 3,
      height: 3,
      rowClues: [[3], [1], [3]],
      colClues: [[3], [1, 1], [1, 1]],
    });

    expect(result.status).toBe("solved");
    expect(result.grid).toEqual([
      FILLED, FILLED, FILLED,
      FILLED, MARKED_EMPTY, MARKED_EMPTY,
      FILLED, FILLED, FILLED,
    ]);
  });

  it("reports an ambiguous puzzle as stalled instead of guessing", () => {
    const result = solveNonogramLogically({
      width: 2,
      height: 2,
      rowClues: [[1], [1]],
      colClues: [[1], [1]],
    });

    expect(result.status).toBe("stalled");
  });
});
