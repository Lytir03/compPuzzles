import { describe, expect, it } from "vitest";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import {
  MAX_PAYLOAD_LENGTH,
  parseMatchProgress,
  parseMatchSubmit,
  parseQueueJoin,
} from "./validation";

const NON_OBJECTS = [null, undefined, 0, "", "string", true, [], () => {}];

describe("parseQueueJoin", () => {
  it("accepts a valid pair", () => {
    expect(parseQueueJoin({ gameType: GameType.SUDOKU, difficulty: Difficulty.HARD })).toEqual({
      gameType: GameType.SUDOKU,
      difficulty: Difficulty.HARD,
    });
  });

  it("rejects enum values Prisma would throw on", () => {
    // This is the crash path: an unknown difficulty used to reach Prisma.
    expect(parseQueueJoin({ gameType: GameType.SUDOKU, difficulty: "LOL" })).toBeNull();
    expect(parseQueueJoin({ gameType: "CHESS", difficulty: Difficulty.EASY })).toBeNull();
  });

  it("rejects missing fields and non-objects", () => {
    expect(parseQueueJoin({ gameType: GameType.SUDOKU })).toBeNull();
    expect(parseQueueJoin({ difficulty: Difficulty.EASY })).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseQueueJoin(bad)).toBeNull();
  });

  it("rejects a case-mismatched enum", () => {
    expect(parseQueueJoin({ gameType: "sudoku", difficulty: "easy" })).toBeNull();
  });
});

describe("parseMatchProgress", () => {
  it("clamps and rounds percent", () => {
    expect(parseMatchProgress({ matchId: "m1", percent: 62.4 })?.percent).toBe(62);
    expect(parseMatchProgress({ matchId: "m1", percent: -20 })?.percent).toBe(0);
    expect(parseMatchProgress({ matchId: "m1", percent: 9001 })?.percent).toBe(100);
  });

  it("rejects NaN and Infinity", () => {
    // These survived the old Math.max(0, Math.min(100, Math.round(x))) clamp
    // and were broadcast to the opponent as-is.
    expect(parseMatchProgress({ matchId: "m1", percent: NaN })).toBeNull();
    expect(parseMatchProgress({ matchId: "m1", percent: Infinity })).toBeNull();
    expect(parseMatchProgress({ matchId: "m1" })).toBeNull();
  });

  it("rejects a non-numeric percent", () => {
    expect(parseMatchProgress({ matchId: "m1", percent: "50" })).toBeNull();
  });

  it("rejects bad match ids", () => {
    expect(parseMatchProgress({ matchId: "", percent: 50 })).toBeNull();
    expect(parseMatchProgress({ matchId: "x".repeat(65), percent: 50 })).toBeNull();
    expect(parseMatchProgress({ matchId: 123, percent: 50 })).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseMatchProgress(bad)).toBeNull();
  });
});

describe("parseMatchSubmit", () => {
  it("accepts a plausible payload", () => {
    expect(parseMatchSubmit({ matchId: "m1", payload: "0".repeat(81) })).toEqual({
      matchId: "m1",
      payload: "0".repeat(81),
    });
  });

  it("rejects non-string and empty payloads", () => {
    expect(parseMatchSubmit({ matchId: "m1", payload: null })).toBeNull();
    expect(parseMatchSubmit({ matchId: "m1", payload: "" })).toBeNull();
    expect(parseMatchSubmit({ matchId: "m1", payload: { grid: [] } })).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseMatchSubmit(bad)).toBeNull();
  });

  it("caps payload size", () => {
    expect(parseMatchSubmit({ matchId: "m1", payload: "a".repeat(MAX_PAYLOAD_LENGTH) })).not.toBeNull();
    expect(parseMatchSubmit({ matchId: "m1", payload: "a".repeat(MAX_PAYLOAD_LENGTH + 1) })).toBeNull();
  });

  it("still admits malformed JSON, which the handler must survive", () => {
    // Shape validation can't tell "{" from valid JSON — the guarantee that a
    // JSON.parse throw doesn't kill the process lives in server.ts's handler
    // wrapper, not here. This pins the division of responsibility.
    expect(parseMatchSubmit({ matchId: "m1", payload: "{" })).toEqual({
      matchId: "m1",
      payload: "{",
    });
  });
});
