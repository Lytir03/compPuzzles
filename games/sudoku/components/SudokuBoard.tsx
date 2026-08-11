"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EMPTY, GRID_SIZE, cellIndex, colOf, formatElapsed, gridFromString, rowOf } from "../engine";
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
  const [grid, setGrid] = useState<number[]>(() => [...given]);
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
    if (isClean && !submittedRef.current) {
      submittedRef.current = true;
      onSubmit(grid, Date.now() - (startRef.current ?? Date.now()));
    }
  }, [isClean, grid, onSubmit]);

  useEffect(() => {
    onProgress?.(grid);
  }, [grid, onProgress]);

  function setCellValue(index: number, value: number) {
    if (disabled || given[index] !== EMPTY) return;
    setGrid((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  /** Steps in the given direction, skipping over given (non-focusable) cells. */
  function moveSelection(fromIndex: number, dr: number, dc: number) {
    let r = rowOf(fromIndex);
    let c = colOf(fromIndex);
    let candidate = fromIndex;
    while (true) {
      const nextRow = r + dr;
      const nextCol = c + dc;
      if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) break;
      r = nextRow;
      c = nextCol;
      candidate = cellIndex(r, c);
      if (given[candidate] === EMPTY) break;
    }
    setSelected(candidate);
    document.getElementById(cellDomId(candidate))?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key >= "1" && event.key <= "9") {
      setCellValue(index, Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      setCellValue(index, EMPTY);
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

      <div
        role="grid"
        aria-label="Sudoku board"
        className="grid w-[min(92vw,29rem)] grid-cols-9 overflow-hidden rounded-2xl border-[3px] border-[#353a31] bg-[#353a31] shadow-[0_8px_0_#242820,0_18px_35px_rgba(30,35,26,.18)]"
      >
        {grid.map((value, index) => {
          const isGiven = given[index] !== EMPTY;
          const isConflict = conflicts.has(index);
          const r = rowOf(index);
          const c = colOf(index);
          const isSelected = selected === index;
          const selectedValue = selected === null ? EMPTY : grid[selected];
          const isMatching = selectedValue !== EMPTY && value === selectedValue;
          const isPeer =
            selected !== null &&
            (r === rowOf(selected) || c === colOf(selected)) &&
            !isSelected;
          const cellTone = isSelected
            ? "bg-[#a9d889] text-[#254c12]"
            : isConflict
              ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              : isMatching
                ? "bg-[#e7f3d9] text-[#4f812f] dark:bg-[#3a4b31] dark:text-[#bfe3a3]"
                : isPeer
                  ? "bg-[#f0eee5] dark:bg-[#363a34]"
                  : isGiven
                    ? "bg-[#e4e1d7] dark:bg-[#41453e]"
                    : "bg-[var(--surface)]";
          return (
            <button
              key={index}
              id={cellDomId(index)}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1}, column ${c + 1}${value !== EMPTY ? `, ${value}` : ""}`}
              aria-selected={isSelected}
              disabled={disabled || isGiven}
              onFocus={() => setSelected(index)}
              onClick={() => setSelected(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                "flex aspect-square w-full items-center justify-center border-b border-r border-[var(--line)] text-[clamp(1rem,4vw,1.35rem)] outline-none transition-colors",
                "focus-visible:relative focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#4b91d1]/60 disabled:cursor-default",
                c === 2 || c === 5 ? "border-r-[3px] border-r-[#353a31]" : "",
                r === 2 || r === 5 ? "border-b-[3px] border-b-[#353a31]" : "",
                isGiven ? "font-black text-[color-mix(in_srgb,var(--foreground)_86%,transparent)]" : "font-extrabold",
                disabled && !isGiven ? "opacity-60" : "",
                cellTone,
              ].join(" ")}
            >
              {value !== EMPTY ? value : ""}
            </button>
          );
        })}
      </div>

      <div className="grid w-[min(92vw,34rem)] grid-cols-5 gap-2 sm:grid-cols-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled || selected === null || given[selected] !== EMPTY}
            onClick={() => selected !== null && setCellValue(selected, digit)}
            className={`soft-button h-12 rounded-xl text-lg font-black disabled:cursor-not-allowed disabled:opacity-35 ${
              selected !== null && grid[selected] === digit
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                : ""
            }`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          aria-label="Clear cell"
          disabled={disabled || selected === null || given[selected] !== EMPTY}
          onClick={() => selected !== null && setCellValue(selected, EMPTY)}
          className="soft-button h-12 rounded-xl text-sm font-black text-[var(--coral)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Clear
        </button>
      </div>
      <p className="subtle-text text-center text-xs font-semibold">
        Tap a square, then a number · Arrow keys work too
      </p>
    </div>
  );
}
