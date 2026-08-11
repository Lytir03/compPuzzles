export const BLACK = "#";

export interface CrosswordDimensions {
  width: number;
  height: number;
}

export function cellIndex(dims: CrosswordDimensions, row: number, col: number): number {
  return row * dims.width + col;
}

/** Flat, row-major. Each entry is `BLACK` or a single A-Z letter (empty cells use ""). */
export type CrosswordGrid = string[];

export function emptyGrid(dims: CrosswordDimensions, mask: boolean[]): CrosswordGrid {
  return mask.map((isBlack) => (isBlack ? BLACK : ""));
}

export interface CrosswordClue {
  number: number;
  row: number;
  col: number;
  length: number;
  clue: string;
}

export interface CrosswordSlot {
  number: number;
  row: number;
  col: number;
  length: number;
  direction: "across" | "down";
}

function isOpenAt(mask: boolean[], dims: CrosswordDimensions, row: number, col: number): boolean {
  if (row < 0 || row >= dims.height || col < 0 || col >= dims.width) return false;
  return !mask[cellIndex(dims, row, col)];
}

/**
 * Standard crossword numbering: scan row-major, a cell gets a number if it
 * starts an across run (nothing open to its left, something open to its
 * right) and/or a down run (nothing open above, something open below).
 */
export function deriveSlots(mask: boolean[], dims: CrosswordDimensions): CrosswordSlot[] {
  const slots: CrosswordSlot[] = [];
  let number = 0;
  for (let row = 0; row < dims.height; row++) {
    for (let col = 0; col < dims.width; col++) {
      if (!isOpenAt(mask, dims, row, col)) continue;
      const startsAcross = !isOpenAt(mask, dims, row, col - 1) && isOpenAt(mask, dims, row, col + 1);
      const startsDown = !isOpenAt(mask, dims, row - 1, col) && isOpenAt(mask, dims, row + 1, col);
      if (!startsAcross && !startsDown) continue;
      number++;
      if (startsAcross) {
        let length = 0;
        while (isOpenAt(mask, dims, row, col + length)) length++;
        slots.push({ number, row, col, length, direction: "across" });
      }
      if (startsDown) {
        let length = 0;
        while (isOpenAt(mask, dims, row + length, col)) length++;
        slots.push({ number, row, col, length, direction: "down" });
      }
    }
  }
  return slots;
}

export function slotCells(slot: CrosswordSlot, dims: CrosswordDimensions): number[] {
  return Array.from({ length: slot.length }, (_, i) =>
    slot.direction === "across"
      ? cellIndex(dims, slot.row, slot.col + i)
      : cellIndex(dims, slot.row + i, slot.col),
  );
}

export interface CrosswordPuzzlePayload extends CrosswordDimensions {
  title: string;
  /** Flat, row-major; true = black square. Never includes letters. */
  mask: boolean[];
  across: CrosswordClue[];
  down: CrosswordClue[];
}

/** Input-boundary validation for a decoded grid before trusting its shape. */
export function isValidGrid(grid: unknown, dims: CrosswordDimensions, mask: boolean[]): grid is CrosswordGrid {
  if (!Array.isArray(grid) || grid.length !== dims.width * dims.height) return false;
  return grid.every((cell, i) => {
    if (typeof cell !== "string") return false;
    if (mask[i]) return cell === BLACK;
    return cell === "" || /^[A-Z]$/.test(cell);
  });
}

/**
 * Wire format for both the puzzle prompt (client payload — safe, no
 * solution) and a submitted/in-progress grid: plain JSON strings, matching
 * Sudoku/Nonogram's string-payload convention on GameDefinition/socket events.
 */
export function encodePuzzlePayload(payload: CrosswordPuzzlePayload): string {
  return JSON.stringify(payload);
}

export function decodePuzzlePayload(payload: string): CrosswordPuzzlePayload {
  return JSON.parse(payload) as CrosswordPuzzlePayload;
}

export function encodeGrid(grid: CrosswordGrid): string {
  return JSON.stringify(grid);
}

export function decodeGrid(payload: string): CrosswordGrid {
  return JSON.parse(payload) as CrosswordGrid;
}

export { formatElapsed } from "@/lib/formatElapsed";
