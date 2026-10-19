import type { GameType } from "@/database/generated/client/enums";

const MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_PREFIX = "cp:ranked:last-match:";

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function availableStorage(storage?: SessionStorageLike): SessionStorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function keyFor(gameType: GameType): string {
  return `${KEY_PREFIX}${gameType}`;
}

/** Stores only an opaque match UUID; no result, account or competitor data. */
export function rememberRankedMatch(
  gameType: GameType,
  matchId: string,
  storage?: SessionStorageLike,
): void {
  if (!MATCH_ID_PATTERN.test(matchId)) return;
  try {
    availableStorage(storage)?.setItem(keyFor(gameType), matchId);
  } catch {
    // sessionStorage may be unavailable in privacy-restricted contexts.
  }
}

export function readRememberedRankedMatch(
  gameType: GameType,
  storage?: SessionStorageLike,
): string | null {
  try {
    const selectedStorage = availableStorage(storage);
    const value = selectedStorage?.getItem(keyFor(gameType)) ?? null;
    if (!value || !MATCH_ID_PATTERN.test(value)) {
      if (value) selectedStorage?.removeItem(keyFor(gameType));
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function forgetRankedMatch(gameType: GameType, storage?: SessionStorageLike): void {
  try {
    availableStorage(storage)?.removeItem(keyFor(gameType));
  } catch {
    // Best effort only; the server always re-authorizes membership on sync.
  }
}
