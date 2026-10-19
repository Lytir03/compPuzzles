import { Difficulty, GameType } from "@/database/generated/client/enums";

/**
 * Stable, server-owned identifiers for every mode that may enter ranked
 * matchmaking.  Clients send only one of these ids; game type, difficulty and
 * board size are derived here so unsupported combinations (most importantly
 * Crossword and hard Nonograms) cannot be smuggled through as two otherwise
 * valid enum values.
 */
export const RANKED_MODE_IDS = [
  "SUDOKU_6X6_CHALLENGE",
  "SUDOKU_9X9_EASY",
  "SUDOKU_9X9_HARD",
  "NONOGRAM_5X5",
  "NONOGRAM_10X10",
] as const;

export type RankedModeId = (typeof RANKED_MODE_IDS)[number];

export interface RankedModeDefinition {
  readonly id: RankedModeId;
  readonly gameType: GameType;
  readonly difficulty: Difficulty;
  readonly width: number;
  readonly height: number;
  readonly estimatedMinutes?: readonly [number, number];
}

export const RANKED_MODES: Readonly<Record<RankedModeId, RankedModeDefinition>> = {
  SUDOKU_6X6_CHALLENGE: {
    id: "SUDOKU_6X6_CHALLENGE",
    gameType: GameType.SUDOKU,
    difficulty: Difficulty.EASY,
    width: 6,
    height: 6,
    estimatedMinutes: [2, 3],
  },
  SUDOKU_9X9_EASY: {
    id: "SUDOKU_9X9_EASY",
    gameType: GameType.SUDOKU,
    difficulty: Difficulty.MEDIUM,
    width: 9,
    height: 9,
  },
  SUDOKU_9X9_HARD: {
    id: "SUDOKU_9X9_HARD",
    gameType: GameType.SUDOKU,
    difficulty: Difficulty.HARD,
    width: 9,
    height: 9,
  },
  NONOGRAM_5X5: {
    id: "NONOGRAM_5X5",
    gameType: GameType.NONOGRAM,
    difficulty: Difficulty.EASY,
    width: 5,
    height: 5,
  },
  NONOGRAM_10X10: {
    id: "NONOGRAM_10X10",
    gameType: GameType.NONOGRAM,
    difficulty: Difficulty.MEDIUM,
    width: 10,
    height: 10,
  },
};

const RANKED_MODE_ID_SET = new Set<string>(RANKED_MODE_IDS);

export function isRankedModeId(value: unknown): value is RankedModeId {
  return typeof value === "string" && RANKED_MODE_ID_SET.has(value);
}

export function getRankedMode(modeId: RankedModeId): RankedModeDefinition {
  return RANKED_MODES[modeId];
}

export function rankedModeIdFor(gameType: GameType, difficulty: Difficulty): RankedModeId | null {
  for (const modeId of RANKED_MODE_IDS) {
    const mode = RANKED_MODES[modeId];
    if (mode.gameType === gameType && mode.difficulty === difficulty) return modeId;
  }
  return null;
}

/** Practice whitelist. Practice code may use this as it moves to assignments. */
export const PRACTICE_MODE_IDS = [
  ...RANKED_MODE_IDS,
  "MINESWEEPER_9X9_10",
  "MINESWEEPER_16X16_40",
  "MINESWEEPER_30X16_99",
] as const;

export type PracticeModeId = (typeof PRACTICE_MODE_IDS)[number];
