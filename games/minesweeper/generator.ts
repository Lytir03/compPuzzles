import { Difficulty } from "@/database/generated/client/enums";
import { neighbors, type MineMap, type MinesweeperDimensions } from "./engine";
import { solveMinesweeperLogically } from "./solver";

export interface MinesweeperConfig extends MinesweeperDimensions {
  mineCount: number;
}

export const DIFFICULTY_CONFIG: Record<string, MinesweeperConfig> = {
  [Difficulty.EASY]: { width: 9, height: 9, mineCount: 10 },
  [Difficulty.MEDIUM]: { width: 16, height: 16, mineCount: 40 },
  [Difficulty.HARD]: { width: 30, height: 16, mineCount: 99 },
};

const MAX_GENERATION_ATTEMPTS = 10_000;

export interface GeneratedMinesweeper extends MinesweeperConfig {
  mines: MineMap;
  openingCell: number;
  seed: number;
}

/** Small deterministic PRNG so a board can be recreated from one integer. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomSeed(): number {
  return Math.floor(Math.random() * 4_294_967_296) >>> 0;
}

function candidateMineMap(
  config: MinesweeperConfig,
  openingCell: number,
  random: () => number,
): MineMap {
  const mines = new Array(config.width * config.height).fill(false);
  const protectedCells = new Set([openingCell, ...neighbors(config, openingCell)]);
  const available = mines
    .map((_, index) => index)
    .filter((index) => !protectedCells.has(index));

  for (let index = available.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
  }
  for (let index = 0; index < config.mineCount; index++) mines[available[index]] = true;
  return mines;
}

/**
 * Produces a reproducible board with a zero-valued central opening. Candidates
 * are rejected until the deterministic solver can finish without guessing.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  seed: number = randomSeed(),
): GeneratedMinesweeper {
  const config = DIFFICULTY_CONFIG[difficulty];
  const random = seededRandom(seed);
  const openingRow = Math.floor(config.height / 2);
  const openingCol = Math.floor(config.width / 2);
  const openingCell = openingRow * config.width + openingCol;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const mines = candidateMineMap(config, openingCell, random);
    const result = solveMinesweeperLogically(mines, config, config.mineCount, openingCell);
    if (result.status === "solved") {
      return { ...config, mines, openingCell, seed: seed >>> 0 };
    }
  }

  throw new Error(`Unable to generate a logic-solvable ${difficulty} Minesweeper board`);
}
