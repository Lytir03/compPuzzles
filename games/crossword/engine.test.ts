import { describe, expect, it } from "vitest";
import { cellIndex, deriveSlots, emptyGrid, isValidGrid, slotCells } from "./engine";

describe("deriveSlots", () => {
  it("numbers a simple open grid with one across and one down word", () => {
    // . . .
    // . . .
    // . . .
    const dims = { width: 3, height: 3 };
    const mask = new Array(9).fill(false);
    const slots = deriveSlots(mask, dims);

    const across1 = slots.find((s) => s.direction === "across" && s.row === 0 && s.col === 0);
    const down1 = slots.find((s) => s.direction === "down" && s.row === 0 && s.col === 0);
    expect(across1).toMatchObject({ number: 1, length: 3 });
    expect(down1).toMatchObject({ number: 1, length: 3 });
  });

  it("skips black squares and gives a fresh number to the next open run", () => {
    // . # .
    // . # .
    // . . .
    const dims = { width: 3, height: 3 };
    const mask = [false, true, false, false, true, false, false, false, false];
    const slots = deriveSlots(mask, dims);

    // Column 0 (down, len 3) and column 2 (down, len 3) both start at row 0.
    const col0 = slots.find((s) => s.direction === "down" && s.col === 0);
    const col2 = slots.find((s) => s.direction === "down" && s.col === 2);
    expect(col0).toMatchObject({ number: 1, length: 3 });
    expect(col2).toMatchObject({ number: 2, length: 3 });

    // Row 2 is a single open run of length 3, starting at (2,0).
    const row2 = slots.find((s) => s.direction === "across" && s.row === 2);
    expect(row2).toMatchObject({ col: 0, length: 3 });
  });

  it("does not create a slot for a length-1 run", () => {
    // A single open cell surrounded by black squares on both row sides
    // shouldn't register as an across slot (only its down slot, if any).
    // . # .
    // # . #
    // . # .
    const dims = { width: 3, height: 3 };
    const mask = [false, true, false, true, false, true, false, true, false];
    const slots = deriveSlots(mask, dims);
    const acrossSlots = slots.filter((s) => s.direction === "across");
    expect(acrossSlots).toHaveLength(0);
  });

  it("never derives a slot shorter than 2 cells", () => {
    const dims = { width: 5, height: 5 };
    const mask = ["##...", "##...", ".....", "...##", "...##"]
      .join("")
      .split("")
      .map((c) => c === "#");
    const slots = deriveSlots(mask, dims);
    expect(slots.every((s) => s.length >= 2)).toBe(true);
  });
});

describe("slotCells", () => {
  it("lists cell indices left-to-right for an across slot", () => {
    const dims = { width: 4, height: 4 };
    const cells = slotCells({ number: 1, row: 1, col: 0, length: 3, direction: "across" }, dims);
    expect(cells).toEqual([cellIndex(dims, 1, 0), cellIndex(dims, 1, 1), cellIndex(dims, 1, 2)]);
  });

  it("lists cell indices top-to-bottom for a down slot", () => {
    const dims = { width: 4, height: 4 };
    const cells = slotCells({ number: 1, row: 0, col: 2, length: 3, direction: "down" }, dims);
    expect(cells).toEqual([cellIndex(dims, 0, 2), cellIndex(dims, 1, 2), cellIndex(dims, 2, 2)]);
  });
});

describe("emptyGrid / isValidGrid", () => {
  const dims = { width: 2, height: 2 };
  const mask = [false, true, false, false];

  it("creates black squares at masked cells and blanks elsewhere", () => {
    expect(emptyGrid(dims, mask)).toEqual(["", "#", "", ""]);
  });

  it("accepts a well-formed grid", () => {
    expect(isValidGrid(["A", "#", "B", ""], dims, mask)).toBe(true);
  });

  it("rejects a letter where the mask expects black", () => {
    expect(isValidGrid(["A", "B", "B", ""], dims, mask)).toBe(false);
  });

  it("rejects a black square where the mask expects open", () => {
    expect(isValidGrid(["#", "#", "B", ""], dims, mask)).toBe(false);
  });

  it("rejects multi-character or lowercase entries", () => {
    expect(isValidGrid(["AB", "#", "B", ""], dims, mask)).toBe(false);
    expect(isValidGrid(["a", "#", "B", ""], dims, mask)).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isValidGrid(["A", "#", "B"], dims, mask)).toBe(false);
  });
});
