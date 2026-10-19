"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY,
  cellIndex,
  colOf,
  formatElapsed,
  gridFromString,
  peersOf,
  rowOf,
  rulesForGrid,
} from "../engine";
import {
  clearCellNotes,
  emptyNotes,
  hasNote,
  removeNoteFromCells,
  toggleNote,
} from "../notes";
import { findConflicts } from "../validator";

export interface SudokuBoardProps {
  initialGrid: string;
  /** Freezes the board (used once a completion submission is in flight or done). */
  disabled?: boolean;
  onSubmit: (grid: number[], elapsedMs: number) => void;
  /** Ranked mode only — reports every grid change for the opponent-progress broadcast. */
  onProgress?: (grid: number[]) => void;
}

function cellDomId(index: number) {
  return `sudoku-cell-${index}`;
}

const ARROW_MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export function SudokuBoard({
  initialGrid,
  disabled = false,
  onSubmit,
  onProgress,
}: SudokuBoardProps) {
  const given = useMemo(() => gridFromString(initialGrid), [initialGrid]);
  const rules = useMemo(() => rulesForGrid(given), [given]);
  const [grid, setGrid] = useState<number[]>(() => [...given]);
  const [notes, setNotes] = useState<number[]>(() => emptyNotes(given.length));
  const [notesMode, setNotesMode] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const conflicts = useMemo(() => findConflicts(grid), [grid]);
  const isFull = useMemo(() => grid.every((value) => value !== EMPTY), [grid]);
  const isClean = isFull && conflicts.size === 0;

  useEffect(() => {
    startRef.current ??= Date.now();
  }, []);

  useEffect(() => {
    if (disabled || isClean) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - (startRef.current ?? Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [disabled, isClean]);

  useEffect(() => {
    if (!isClean) submittedRef.current = false;
    if (!disabled && isClean && !submittedRef.current) {
      submittedRef.current = true;
      onSubmit(grid, Date.now() - (startRef.current ?? Date.now()));
    }
  }, [disabled, isClean, grid, onSubmit]);

  useEffect(() => {
    onProgress?.(grid);
  }, [grid, onProgress]);

  function enterDigit(index: number, digit: number) {
    if (disabled || given[index] !== EMPTY) return;

    if (notesMode) {
      if (grid[index] === EMPTY) setNotes((previous) => toggleNote(previous, index, digit));
      return;
    }

    setGrid((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setNotes((previous) => {
      const withoutCellNotes = clearCellNotes(previous, index);
      return removeNoteFromCells(withoutCellNotes, peersOf(index, rules), digit);
    });
  }

  function clearCell(index: number) {
    if (disabled || given[index] !== EMPTY) return;
    setGrid((previous) => {
      const next = [...previous];
      next[index] = EMPTY;
      return next;
    });
    setNotes((previous) => clearCellNotes(previous, index));
  }

  /** Steps in the given direction, skipping over given (non-focusable) cells. */
  function moveSelection(fromIndex: number, dr: number, dc: number) {
    let r = rowOf(fromIndex, rules);
    let c = colOf(fromIndex, rules);
    let candidate = fromIndex;
    while (true) {
      const nextRow = r + dr;
      const nextCol = c + dc;
      if (nextRow < 0 || nextRow >= rules.size || nextCol < 0 || nextCol >= rules.size) break;
      r = nextRow;
      c = nextCol;
      candidate = cellIndex(r, c, rules);
      if (given[candidate] === EMPTY) break;
    }
    setSelected(candidate);
    // preventScroll: mobile Safari otherwise scroll-jumps (and sometimes zooms)
    // the board on every arrow step.
    document.getElementById(cellDomId(candidate))?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      setNotesMode((active) => !active);
      return;
    }
    if (event.key >= "1" && event.key <= String(rules.size)) {
      event.preventDefault();
      enterDigit(index, Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      clearCell(index);
      return;
    }
    const move = ARROW_MOVES[event.key];
    if (move) {
      event.preventDefault();
      moveSelection(index, move[0], move[1]);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 shadow-[0_3px_0_color-mix(in_srgb,var(--shadow)_10%,transparent)]">
        <span className="text-sm" aria-hidden="true">⏱</span>
        <span className="font-mono text-base font-black tabular-nums">{formatElapsed(elapsedMs)}</span>
      </div>

      {/* The 9×9 board claims almost all phone width; Blitz's six columns get
          larger targets. The sticky pad below remains the primary value input. */}
      <div
        role="grid"
        aria-label={`${rules.size} by ${rules.size} Sudoku board`}
        className={`grid max-w-full overflow-hidden rounded-2xl border-[3px] border-[#353a31] bg-[#353a31] shadow-[0_8px_0_#242820,0_18px_35px_rgba(30,35,26,.18)] ${
          rules.size === 6 ? "w-[min(94vw,25rem)]" : "w-[min(96vw,29rem)]"
        }`}
        style={{ gridTemplateColumns: `repeat(${rules.size}, minmax(0, 1fr))` }}
      >
        {grid.map((value, index) => {
          const isGiven = given[index] !== EMPTY;
          const isConflict = conflicts.has(index);
          const r = rowOf(index, rules);
          const c = colOf(index, rules);
          const isSelected = selected === index;
          const selectedValue = selected === null ? EMPTY : grid[selected];
          const isMatching = selectedValue !== EMPTY && value === selectedValue;
          const isPeer = selected !== null && peersOf(selected, rules).includes(index);
          const cellNotes = notes[index];
          const noteDigits = Array.from({ length: rules.size }, (_, digitIndex) => digitIndex + 1);
          const boxBoundaryCol = (c + 1) % rules.boxCols === 0 && c < rules.size - 1;
          const boxBoundaryRow = (r + 1) % rules.boxRows === 0 && r < rules.size - 1;
          // Fixed colors intentionally ignore the OS theme. The gameplay grid
          // should have identical contrast and hierarchy in light and dark UI.
          const cellTone = isSelected
            ? "bg-[#a9d889] text-[#254c12]"
            : isConflict
              ? "bg-[#ffd9d4] text-[#a62e25]"
              : isMatching
                ? "bg-[#dceecb] text-[#3f7027]"
                : isPeer
                  ? isGiven
                    ? "bg-[#d2d3ca] text-[#30352d]"
                    : "bg-[#f0eee5] text-[#315d88]"
                  : isGiven
                    ? "bg-[#dedbd1] text-[#30352d]"
                    : "bg-[#fffdf7] text-[#315d88]";
          return (
            <button
              key={index}
              id={cellDomId(index)}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1}, column ${c + 1}${
                value !== EMPTY
                  ? `, ${value}`
                  : cellNotes !== 0
                    ? `, notes ${noteDigits.filter((digit) => hasNote(cellNotes, digit)).join(", ")}`
                    : ""
              }`}
              aria-selected={isSelected}
              disabled={disabled || isGiven}
              onFocus={() => setSelected(index)}
              onClick={() => setSelected(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                `relative flex aspect-square w-full items-center justify-center border-b border-r border-[#c9c5b9] outline-none transition-colors ${
                  rules.size === 6 ? "text-[clamp(1.2rem,6vw,1.65rem)]" : "text-[clamp(1rem,4vw,1.35rem)]"
                }`,
                "focus-visible:relative focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#4b91d1]/60 disabled:cursor-default",
                boxBoundaryCol ? "border-r-[3px] border-r-[#353a31]" : "",
                boxBoundaryRow ? "border-b-[3px] border-b-[#353a31]" : "",
                isGiven ? "font-black" : "font-extrabold",
                disabled && !isGiven ? "opacity-60" : "",
                cellTone,
              ].join(" ")}
            >
              {value !== EMPTY ? (
                value
              ) : cellNotes !== 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-[5%] grid grid-cols-3 grid-rows-3 text-[clamp(0.48rem,2vw,0.72rem)] font-black leading-none text-[#315d88]"
                >
                  {noteDigits.map((digit) => (
                    <span key={digit} className="flex items-center justify-center">
                      {hasNote(cellNotes, digit) ? digit : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="subtle-text text-center text-xs font-semibold">
        Tap a square, then a number · Press N to toggle notes
      </p>

      {/* Sticky on phones: with the timer, board and opponent-progress bar
          stacked above it, a static pad sat below the fold mid-match and every
          entry cost a scroll. */}
      <div className="sticky bottom-0 z-20 w-full max-w-full border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:static sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto mb-3 flex w-full max-w-full items-center justify-end sm:w-[min(96vw,34rem)]">
          <button
            type="button"
            aria-label={`Turn notes ${notesMode ? "off" : "on"}`}
            aria-pressed={notesMode}
            disabled={disabled}
            onClick={() => setNotesMode((active) => !active)}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-black shadow-[0_3px_0_#c5c0b3] transition disabled:cursor-not-allowed disabled:opacity-35 ${
              notesMode
                ? "border-[#6ca642] bg-[#dceecb] text-[#315f1d]"
                : "border-[#d2cec2] bg-[#fffdf7] text-[#30352d] hover:bg-[#f3f0e7]"
            }`}
          >
            <span aria-hidden="true">✎</span>
            Notes
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                notesMode ? "bg-[#6ca642] text-white" : "bg-[#e4e1d7] text-[#62675f]"
              }`}
            >
              {notesMode ? "On" : "Off"}
            </span>
          </button>
        </div>
        <div
          className={`mx-auto grid w-full max-w-full gap-2 sm:w-[min(96vw,34rem)] ${
            rules.size === 6 ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-5 sm:grid-cols-10"
          }`}
        >
          {Array.from({ length: rules.size }, (_, index) => index + 1).map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={disabled || selected === null || given[selected] !== EMPTY}
              onClick={() => selected !== null && enterDigit(selected, digit)}
              className={`h-12 min-h-11 rounded-xl border border-[#d2cec2] bg-[#fffdf7] text-lg font-black text-[#30352d] shadow-[0_3px_0_#c5c0b3] transition disabled:cursor-not-allowed disabled:opacity-35 ${
                selected !== null &&
                (grid[selected] === digit || (notesMode && hasNote(notes[selected], digit)))
                  ? "border-[#6ca642] bg-[#dceecb] text-[#315f1d]"
                  : "hover:bg-[#f3f0e7]"
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            aria-label="Clear cell"
            disabled={disabled || selected === null || given[selected] !== EMPTY}
            onClick={() => selected !== null && clearCell(selected)}
            className="h-12 min-h-11 rounded-xl border border-[#d2cec2] bg-[#fffdf7] text-sm font-black text-[#c24d3e] shadow-[0_3px_0_#c5c0b3] transition hover:bg-[#f3f0e7] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
