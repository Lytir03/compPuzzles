"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EMPTY, GRID_SIZE, cellIndex, colOf, formatElapsed, gridFromString, rowOf } from "../engine";
import { findConflicts } from "../validator";

export interface SudokuBoardProps {
  initialGrid: string;
  /** Freezes the board (used once a completion submission is in flight or done). */
  disabled?: boolean;
  onSubmit: (grid: number[], elapsedMs: number) => void;
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

export function SudokuBoard({ initialGrid, disabled = false, onSubmit }: SudokuBoardProps) {
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
    <div className="flex flex-col items-center gap-4">
      <div className="font-mono text-lg tabular-nums">{formatElapsed(elapsedMs)}</div>

      <div
        role="grid"
        aria-label="Sudoku board"
        className="grid grid-cols-9 border-2 border-black/70 dark:border-white/70"
      >
        {grid.map((value, index) => {
          const isGiven = given[index] !== EMPTY;
          const isConflict = conflicts.has(index);
          const r = rowOf(index);
          const c = colOf(index);
          return (
            <button
              key={index}
              id={cellDomId(index)}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1}, column ${c + 1}${value !== EMPTY ? `, ${value}` : ""}`}
              disabled={disabled || isGiven}
              onFocus={() => setSelected(index)}
              onClick={() => setSelected(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                "flex h-9 w-9 items-center justify-center text-lg outline-none sm:h-11 sm:w-11",
                "border border-black/15 dark:border-white/15",
                c % 3 === 0 ? "border-l-2 border-l-black/70 dark:border-l-white/70" : "",
                r % 3 === 0 ? "border-t-2 border-t-black/70 dark:border-t-white/70" : "",
                c === GRID_SIZE - 1 ? "border-r-2 border-r-black/70 dark:border-r-white/70" : "",
                r === GRID_SIZE - 1 ? "border-b-2 border-b-black/70 dark:border-b-white/70" : "",
                isGiven
                  ? "bg-black/5 font-bold dark:bg-white/10"
                  : "bg-transparent disabled:opacity-60",
                isConflict ? "text-red-600" : "",
                selected === index ? "bg-blue-500/15" : "",
              ].join(" ")}
            >
              {value !== EMPTY ? value : ""}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled || selected === null || given[selected] !== EMPTY}
            onClick={() => selected !== null && setCellValue(selected, digit)}
            className="h-10 w-10 rounded-lg border border-black/10 text-lg font-semibold disabled:opacity-30 dark:border-white/10"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          aria-label="Clear cell"
          disabled={disabled || selected === null || given[selected] !== EMPTY}
          onClick={() => selected !== null && setCellValue(selected, EMPTY)}
          className="h-10 w-10 rounded-lg border border-black/10 text-sm disabled:opacity-30 dark:border-white/10"
        >
          ×
        </button>
      </div>
    </div>
  );
}
