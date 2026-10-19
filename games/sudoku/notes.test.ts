import { describe, expect, it } from "vitest";
import {
  clearCellNotes,
  emptyNotes,
  hasNote,
  removeNoteFromCells,
  toggleNote,
} from "./notes";

describe("Sudoku notes", () => {
  it("toggles individual candidates without changing other cells", () => {
    const empty = emptyNotes(36);
    const withTwo = toggleNote(empty, 4, 2);
    const withTwoAndSix = toggleNote(withTwo, 4, 6);

    expect(hasNote(withTwoAndSix[4], 2)).toBe(true);
    expect(hasNote(withTwoAndSix[4], 6)).toBe(true);
    expect(withTwoAndSix[3]).toBe(0);
    expect(hasNote(toggleNote(withTwoAndSix, 4, 2)[4], 2)).toBe(false);
  });

  it("clears a cell's candidates", () => {
    const notes = toggleNote(toggleNote(emptyNotes(36), 8, 1), 8, 3);
    expect(clearCellNotes(notes, 8)[8]).toBe(0);
  });

  it("removes a committed digit only from peer cells", () => {
    let notes = emptyNotes(36);
    notes = toggleNote(notes, 1, 4);
    notes = toggleNote(notes, 2, 4);
    notes = toggleNote(notes, 3, 4);

    const cleaned = removeNoteFromCells(notes, [1, 3], 4);
    expect(hasNote(cleaned[1], 4)).toBe(false);
    expect(hasNote(cleaned[2], 4)).toBe(true);
    expect(hasNote(cleaned[3], 4)).toBe(false);
  });
});
