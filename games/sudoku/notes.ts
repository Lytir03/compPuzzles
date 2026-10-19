export type SudokuNotes = number[];

export function emptyNotes(cellCount: number): SudokuNotes {
  return new Array<number>(cellCount).fill(0);
}

export function hasNote(mask: number, digit: number): boolean {
  return (mask & (1 << digit)) !== 0;
}

export function toggleNote(notes: SudokuNotes, cell: number, digit: number): SudokuNotes {
  const next = [...notes];
  next[cell] ^= 1 << digit;
  return next;
}

export function clearCellNotes(notes: SudokuNotes, cell: number): SudokuNotes {
  if (notes[cell] === 0) return notes;
  const next = [...notes];
  next[cell] = 0;
  return next;
}

export function removeNoteFromCells(
  notes: SudokuNotes,
  cells: readonly number[],
  digit: number,
): SudokuNotes {
  const bit = 1 << digit;
  if (!cells.some((cell) => (notes[cell] & bit) !== 0)) return notes;

  const next = [...notes];
  for (const cell of cells) next[cell] &= ~bit;
  return next;
}
