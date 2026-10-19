import { describe, expect, it } from "vitest";
import { RANKED_MODE_IDS } from "@/games/modes";
import {
  MAX_PAYLOAD_LENGTH,
  parseMatchProgress,
  parseMatchSync,
  parseMatchSubmit,
  parseQueueJoin,
} from "./validation";

const NON_OBJECTS = [null, undefined, 0, "", "string", true, [], () => {}];
const MATCH_ID = "7e6a988b-75f3-4c87-a78d-cf3f940b22bc";

describe("parseQueueJoin", () => {
  it.each(RANKED_MODE_IDS)("accepts whitelisted mode %s", (modeId) => {
    expect(parseQueueJoin({ modeId })).toEqual({ modeId });
  });

  it("rejects non-whitelisted and legacy game/difficulty payloads", () => {
    expect(parseQueueJoin({ modeId: "CROSSWORD_EASY" })).toBeNull();
    expect(parseQueueJoin({ modeId: "NONOGRAM_15X15" })).toBeNull();
    expect(parseQueueJoin({ gameType: "SUDOKU", difficulty: "HARD" })).toBeNull();
    expect(parseQueueJoin({ modeId: "SUDOKU_6X6_CHALLENGE", extra: true })).toBeNull();
  });

  it("rejects missing fields and non-objects", () => {
    expect(parseQueueJoin({})).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseQueueJoin(bad)).toBeNull();
  });

  it("rejects a case-mismatched mode", () => {
    expect(parseQueueJoin({ modeId: "sudoku_6x6_challenge" })).toBeNull();
  });
});

describe("parseMatchProgress", () => {
  it("clamps and rounds percent", () => {
    expect(parseMatchProgress({ matchId: MATCH_ID, percent: 62.4 })?.percent).toBe(62);
    expect(parseMatchProgress({ matchId: MATCH_ID, percent: -20 })?.percent).toBe(0);
    expect(parseMatchProgress({ matchId: MATCH_ID, percent: 9001 })?.percent).toBe(100);
  });

  it("rejects NaN and Infinity", () => {
    // These survived the old Math.max(0, Math.min(100, Math.round(x))) clamp
    // and were broadcast to the opponent as-is.
    expect(parseMatchProgress({ matchId: MATCH_ID, percent: NaN })).toBeNull();
    expect(parseMatchProgress({ matchId: MATCH_ID, percent: Infinity })).toBeNull();
    expect(parseMatchProgress({ matchId: MATCH_ID })).toBeNull();
  });

  it("rejects a non-numeric percent", () => {
    expect(parseMatchProgress({ matchId: MATCH_ID, percent: "50" })).toBeNull();
  });

  it("rejects bad match ids", () => {
    expect(parseMatchProgress({ matchId: "", percent: 50 })).toBeNull();
    expect(parseMatchProgress({ matchId: "x".repeat(65), percent: 50 })).toBeNull();
    expect(parseMatchProgress({ matchId: "legacy_cuid", percent: 50 })).toBeNull();
    expect(parseMatchProgress({ matchId: 123, percent: 50 })).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseMatchProgress(bad)).toBeNull();
  });
});

describe("parseMatchSync", () => {
  it("accepts only one opaque UUID match id", () => {
    expect(parseMatchSync({ matchId: MATCH_ID })).toEqual({ matchId: MATCH_ID });
    expect(parseMatchSync({ matchId: MATCH_ID, competitorId: MATCH_ID })).toBeNull();
    expect(parseMatchSync({ matchId: "legacy_cuid" })).toBeNull();
    expect(parseMatchSync({})).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseMatchSync(bad)).toBeNull();
  });
});

describe("parseMatchSubmit", () => {
  it("accepts a plausible payload", () => {
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: "0".repeat(81) })).toEqual({
      matchId: MATCH_ID,
      payload: "0".repeat(81),
    });
  });

  it("rejects non-string and empty payloads", () => {
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: null })).toBeNull();
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: "" })).toBeNull();
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: { grid: [] } })).toBeNull();
    for (const bad of NON_OBJECTS) expect(parseMatchSubmit(bad)).toBeNull();
  });

  it("caps payload size", () => {
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: "a".repeat(MAX_PAYLOAD_LENGTH) })).not.toBeNull();
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: "a".repeat(MAX_PAYLOAD_LENGTH + 1) })).toBeNull();
  });

  it("still admits malformed JSON, which the handler must survive", () => {
    // Shape validation can't tell "{" from valid JSON — the guarantee that a
    // JSON.parse throw doesn't kill the process lives in server.ts's handler
    // wrapper, not here. This pins the division of responsibility.
    expect(parseMatchSubmit({ matchId: MATCH_ID, payload: "{" })).toEqual({
      matchId: MATCH_ID,
      payload: "{",
    });
  });
});
