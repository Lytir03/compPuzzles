import type { Difficulty } from "@/database/generated/client/enums";
import { BLACK, type CrosswordDimensions, type CrosswordGrid, cellIndex, deriveSlots, slotCells } from "./engine";

/**
 * Hand-authored puzzle format per docs/SPEC.md §16. `grid` is the
 * black-square layout ('.' open, '#' black); each clue entry gives its
 * answer explicitly rather than relying on position alone, so a mismatch
 * between intended words and the black-square layout fails loudly at import
 * time instead of silently producing a broken puzzle.
 */
export interface CrosswordImportClue {
  number: number;
  row: number;
  col: number;
  answer: string;
  clue: string;
}

export interface CrosswordImportPuzzle {
  title: string;
  difficulty: Difficulty;
  width: number;
  height: number;
  grid: string[];
  clues: {
    across: CrosswordImportClue[];
    down: CrosswordImportClue[];
  };
  author?: string;
  source?: string;
}

export interface ParsedCrosswordPuzzle {
  title: string;
  difficulty: Difficulty;
  width: number;
  height: number;
  mask: boolean[];
  solution: CrosswordGrid;
  across: { number: number; row: number; col: number; length: number; clue: string }[];
  down: { number: number; row: number; col: number; length: number; clue: string }[];
  author?: string;
  source?: string;
}

function fail(title: string, message: string): never {
  throw new Error(`Crossword import "${title}": ${message}`);
}

/**
 * Validates and derives everything match logic needs from a hand-authored
 * puzzle: the black-square mask must match `width`/`height`; every clue
 * entry must land on a slot the standard numbering algorithm actually
 * derives from that mask (same number, same length); and every crossing
 * between an across and a down answer must agree letter-for-letter. Any
 * mismatch is an authoring bug and throws rather than producing a puzzle
 * that can't be solved as intended.
 */
export function parseCrosswordImport(raw: CrosswordImportPuzzle): ParsedCrosswordPuzzle {
  const { title, width, height } = raw;
  if (raw.grid.length !== height || raw.grid.some((row) => row.length !== width)) {
    fail(title, `grid must be ${height} rows of ${width} characters`);
  }
  if (raw.grid.some((row) => /[^.#]/.test(row))) {
    fail(title, "grid rows may only contain '.' (open) and '#' (black)");
  }

  const dims: CrosswordDimensions = { width, height };
  const mask = raw.grid.flatMap((row) => [...row].map((ch) => ch === "#"));

  const derived = deriveSlots(mask, dims);
  const derivedByKey = new Map(derived.map((slot) => [`${slot.direction}:${slot.row}:${slot.col}`, slot]));

  const solution: CrosswordGrid = mask.map((isBlack) => (isBlack ? BLACK : ""));

  function place(direction: "across" | "down", entries: CrosswordImportClue[]) {
    return entries.map((entry) => {
      const key = `${direction}:${entry.row}:${entry.col}`;
      const slot = derivedByKey.get(key);
      if (!slot) {
        fail(title, `no ${direction} word starts at (${entry.row}, ${entry.col}) given the grid layout`);
      }
      if (slot.number !== entry.number) {
        fail(title, `${direction} clue ${entry.number} at (${entry.row}, ${entry.col}) should be numbered ${slot.number}`);
      }
      const answer = entry.answer.toUpperCase();
      if (!/^[A-Z]+$/.test(answer) || answer.length !== slot.length) {
        fail(title, `${direction} ${entry.number} answer "${entry.answer}" must be ${slot.length} letters, A-Z only`);
      }
      slotCells(slot, dims).forEach((idx, i) => {
        const letter = answer[i];
        if (solution[idx] !== "" && solution[idx] !== letter) {
          fail(title, `${direction} ${entry.number} conflicts with a crossing word at cell index ${idx}`);
        }
        solution[idx] = letter;
      });
      return { number: slot.number, row: slot.row, col: slot.col, length: slot.length, clue: entry.clue };
    });
  }

  const across = place("across", raw.clues.across);
  const down = place("down", raw.clues.down);

  if (across.length !== derived.filter((s) => s.direction === "across").length) {
    fail(title, "clues.across is missing an entry the grid layout requires");
  }
  if (down.length !== derived.filter((s) => s.direction === "down").length) {
    fail(title, "clues.down is missing an entry the grid layout requires");
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = cellIndex(dims, row, col);
      if (!mask[idx] && solution[idx] === "") {
        fail(title, `cell (${row}, ${col}) is open but isn't covered by any across/down answer`);
      }
    }
  }

  return {
    title,
    difficulty: raw.difficulty,
    width,
    height,
    mask,
    solution,
    across,
    down,
    author: raw.author,
    source: raw.source,
  };
}
