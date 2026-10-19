import { describe, expect, it } from "vitest";
import { GameType } from "@/database/generated/client/enums";
import {
  forgetRankedMatch,
  readRememberedRankedMatch,
  rememberRankedMatch,
  type SessionStorageLike,
} from "./matchSession";

const MATCH_ID = "7e6a988b-75f3-4c87-a78d-cf3f940b22bc";

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: SessionStorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => { values.delete(key); },
  };
  return { storage, values };
}

describe("ranked match session", () => {
  it("persists only the opaque match UUID and restores it after reload", () => {
    const { storage, values } = memoryStorage();
    rememberRankedMatch(GameType.SUDOKU, MATCH_ID, storage);

    expect([...values.values()]).toEqual([MATCH_ID]);
    expect(readRememberedRankedMatch(GameType.SUDOKU, storage)).toBe(MATCH_ID);
  });

  it("isolates games and drops malformed injected values", () => {
    const { storage, values } = memoryStorage();
    rememberRankedMatch(GameType.SUDOKU, MATCH_ID, storage);
    expect(readRememberedRankedMatch(GameType.NONOGRAM, storage)).toBeNull();

    const key = [...values.keys()][0];
    values.set(key, "competitor-id-or-malformed-data");
    expect(readRememberedRankedMatch(GameType.SUDOKU, storage)).toBeNull();
    expect(values.has(key)).toBe(false);
  });

  it("forgets the replay pointer when starting over", () => {
    const { storage } = memoryStorage();
    rememberRankedMatch(GameType.SUDOKU, MATCH_ID, storage);
    forgetRankedMatch(GameType.SUDOKU, storage);
    expect(readRememberedRankedMatch(GameType.SUDOKU, storage)).toBeNull();
  });
});
