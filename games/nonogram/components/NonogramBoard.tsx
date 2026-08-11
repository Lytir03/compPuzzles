"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FILLED,
  MARKED_EMPTY,
  UNDETERMINED,
  cluesEqual,
  deriveClues,
  emptyGrid,
  formatElapsed,
  type NonogramDimensions,
  type NonogramGrid,
} from "../engine";

export interface NonogramBoardProps {
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  disabled?: boolean;
  onSubmit: (grid: NonogramGrid, elapsedMs: number) => void;
  /** Ranked mode only — reports every grid change for the opponent-progress broadcast. */
  onProgress?: (grid: NonogramGrid) => void;
}

function cycleState(current: number): number {
  if (current === UNDETERMINED) return FILLED;
  if (current === FILLED) return MARKED_EMPTY;
  return UNDETERMINED;
}

export function NonogramBoard({
  width,
  height,
  rowClues,
  colClues,
  disabled = false,
  onSubmit,
  onProgress,
}: NonogramBoardProps) {
  const dims: NonogramDimensions = useMemo(() => ({ width, height }), [width, height]);
  const [grid, setGrid] = useState<NonogramGrid>(() => emptyGrid(dims));
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const dragRef = useRef<{ active: boolean; targetState: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const solved = useMemo(() => {
    const derived = deriveClues(grid, dims);
    return cluesEqual(derived.rowClues, rowClues) && cluesEqual(derived.colClues, colClues);
  }, [grid, dims, rowClues, colClues]);

  useEffect(() => {
    startRef.current ??= Date.now();
  }, []);

  useEffect(() => {
    if (disabled || solved) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - (startRef.current ?? Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [disabled, solved]);

  useEffect(() => {
    if (solved && !submittedRef.current) {
      submittedRef.current = true;
      onSubmit(grid, Date.now() - (startRef.current ?? Date.now()));
    }
  }, [solved, grid, onSubmit]);

  useEffect(() => {
    onProgress?.(grid);
  }, [grid, onProgress]);

  function setCellState(index: number, value: number) {
    if (disabled) return;
    setGrid((prev) => {
      if (prev[index] === value) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handlePointerDown(index: number) {
    if (disabled) return;
    const nextState = cycleState(grid[index]);
    dragRef.current = { active: true, targetState: nextState };
    setCellState(index, nextState);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (disabled || !dragRef.current?.active) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const indexAttr = el?.getAttribute("data-cell-index");
    if (indexAttr === null || indexAttr === undefined) return;
    setCellState(Number(indexAttr), dragRef.current.targetState);
  }

  function endDrag() {
    if (dragRef.current) dragRef.current.active = false;
  }

  function handleContextMenu(event: React.MouseEvent, index: number) {
    event.preventDefault();
    if (disabled) return;
    setCellState(index, grid[index] === MARKED_EMPTY ? UNDETERMINED : MARKED_EMPTY);
  }

  const sizeTier =
    dims.width <= 5
      ? { width: "w-11 sm:w-14", height: "h-11 sm:h-14", text: "text-base" }
      : dims.width <= 10
        ? { width: "w-8 sm:w-10", height: "h-8 sm:h-10", text: "text-sm" }
        : { width: "w-6 sm:w-7", height: "h-6 sm:h-7", text: "text-xs" };
  const cellSizeClass = `${sizeTier.width} ${sizeTier.height} ${sizeTier.text}`;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 shadow-[0_3px_0_color-mix(in_srgb,var(--shadow)_10%,transparent)]">
        <span className="text-sm" aria-hidden="true">⏱</span>
        <span className="font-mono text-base font-black tabular-nums">{formatElapsed(elapsedMs)}</span>
      </div>

      <div
        ref={gridRef}
        className="touch-none select-none overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_4px_0_color-mix(in_srgb,var(--shadow)_10%,transparent)]"
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="grid w-fit gap-px"
          style={{
            gridTemplateColumns: `auto repeat(${dims.width}, auto)`,
          }}
        >
          {/* top-left corner */}
          <div />
          {colClues.map((clue, col) => (
            <div
              key={`col-${col}`}
              className={`flex flex-col items-center justify-end gap-0.5 px-0.5 pb-1 text-[10px] font-black leading-none text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] sm:text-xs ${sizeTier.width}`}
            >
              {(clue.length === 0 ? [0] : clue).map((n, i) => (
                <span key={i}>{clue.length === 0 ? "—" : n}</span>
              ))}
            </div>
          ))}

          {Array.from({ length: dims.height }, (_, row) => (
            <div key={`row-${row}`} className="contents">
              <div
                className={`flex items-center justify-end gap-1 pr-2 text-[10px] font-black leading-none text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] sm:text-xs ${sizeTier.height}`}
              >
                {rowClues[row].length === 0 ? "—" : rowClues[row].join(" ")}
              </div>
              {Array.from({ length: dims.width }, (_, col) => {
                const index = row * dims.width + col;
                const value = grid[index];
                return (
                  <button
                    key={index}
                    type="button"
                    role="gridcell"
                    aria-label={`Row ${row + 1}, column ${col + 1}`}
                    data-cell-index={index}
                    disabled={disabled}
                    onPointerDown={() => handlePointerDown(index)}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                    className={[
                      cellSizeClass,
                      "flex items-center justify-center border border-[var(--line)] font-black outline-none transition-colors",
                      (row + 1) % 5 === 0 && row !== dims.height - 1 ? "border-b-2 border-b-[#353a31]" : "",
                      (col + 1) % 5 === 0 && col !== dims.width - 1 ? "border-r-2 border-r-[#353a31]" : "",
                      value === FILLED
                        ? "bg-[#353a31] text-white"
                        : value === MARKED_EMPTY
                          ? "bg-[var(--surface-muted)] text-[var(--coral)]"
                          : "bg-[var(--surface)] hover:bg-[var(--surface-muted)]",
                    ].join(" ")}
                  >
                    {value === MARKED_EMPTY ? "×" : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="subtle-text text-center text-xs font-semibold">
        Tap to fill · tap again for × · right-click / long-press also marks × · drag to paint
      </p>
    </div>
  );
}
