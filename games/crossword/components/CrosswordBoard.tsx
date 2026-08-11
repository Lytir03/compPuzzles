"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLACK,
  type CrosswordClue,
  type CrosswordDimensions,
  type CrosswordGrid,
  cellIndex,
  deriveSlots,
  emptyGrid,
  formatElapsed,
  slotCells,
  type CrosswordSlot,
} from "../engine";

export interface CrosswordBoardProps {
  title: string;
  width: number;
  height: number;
  mask: boolean[];
  across: CrosswordClue[];
  down: CrosswordClue[];
  disabled?: boolean;
  onSubmit: (grid: CrosswordGrid, elapsedMs: number) => void;
  /** Ranked mode only — reports every grid change for the opponent-progress broadcast. */
  onProgress?: (grid: CrosswordGrid) => void;
}

type Direction = "across" | "down";

export function CrosswordBoard({
  title,
  width,
  height,
  mask,
  across,
  down,
  disabled = false,
  onSubmit,
  onProgress,
}: CrosswordBoardProps) {
  const dims: CrosswordDimensions = useMemo(() => ({ width, height }), [width, height]);
  const [grid, setGrid] = useState<CrosswordGrid>(() => emptyGrid(dims, mask));
  const [selected, setSelected] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const slots = useMemo(() => deriveSlots(mask, dims), [mask, dims]);

  // Which slot covers a given cell for a given direction, and the reverse lookup.
  const slotAt = useMemo(() => {
    const map = new Map<string, CrosswordSlot>();
    for (const slot of slots) {
      for (const idx of slotCells(slot, dims)) {
        map.set(`${slot.direction}:${idx}`, slot);
      }
    }
    return map;
  }, [slots, dims]);

  const activeSlot = selected !== null ? slotAt.get(`${direction}:${selected}`) : undefined;
  const activeCells = useMemo(
    () => (activeSlot ? new Set(slotCells(activeSlot, dims)) : new Set<number>()),
    [activeSlot, dims],
  );

  const filled = useMemo(() => mask.filter((b) => !b).length, [mask]);
  const solved = useMemo(
    () => grid.every((cell, i) => (mask[i] ? cell === BLACK : cell !== "" && cell !== BLACK)),
    [grid, mask],
  );

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

  function setLetter(index: number, letter: string) {
    if (disabled || mask[index]) return;
    setGrid((prev) => {
      if (prev[index] === letter) return prev;
      const next = [...prev];
      next[index] = letter;
      return next;
    });
  }

  function focusCell(index: number) {
    inputRefs.current.get(index)?.focus();
  }

  function nextCellInSlot(from: number, forward: boolean): number | null {
    const slot = slotAt.get(`${direction}:${from}`);
    if (!slot) return null;
    const cells = slotCells(slot, dims);
    const pos = cells.indexOf(from);
    const nextPos = forward ? pos + 1 : pos - 1;
    return cells[nextPos] ?? null;
  }

  function selectCell(index: number) {
    if (mask[index]) return;
    if (selected === index) {
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else {
      setSelected(index);
      const hasAcross = slotAt.has(`across:${index}`);
      const hasDown = slotAt.has(`down:${index}`);
      if (!hasAcross && hasDown) setDirection("down");
      else if (hasAcross && !hasDown) setDirection("across");
    }
    focusCell(index);
  }

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (disabled) return;
    const row = Math.floor(index / width);
    const col = index % width;
    const move = (r: number, c: number) => {
      if (r < 0 || r >= height || c < 0 || c >= width) return;
      const target = cellIndex(dims, r, c);
      if (mask[target]) return;
      setSelected(target);
      focusCell(target);
    };

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        move(row - 1, col);
        return;
      case "ArrowDown":
        event.preventDefault();
        move(row + 1, col);
        return;
      case "ArrowLeft":
        event.preventDefault();
        move(row, col - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        move(row, col + 1);
        return;
      case "Backspace": {
        event.preventDefault();
        if (grid[index]) {
          setLetter(index, "");
          return;
        }
        const prev = nextCellInSlot(index, false);
        if (prev !== null) {
          setLetter(prev, "");
          setSelected(prev);
          focusCell(prev);
        }
        return;
      }
      case "Tab":
        return;
      default:
        if (/^[a-zA-Z]$/.test(event.key)) {
          event.preventDefault();
          setLetter(index, event.key.toUpperCase());
          const next = nextCellInSlot(index, true);
          if (next !== null) {
            setSelected(next);
            focusCell(next);
          }
        }
    }
  }

  function jumpToClue(clue: CrosswordClue, dir: Direction) {
    setDirection(dir);
    setSelected(cellIndex(dims, clue.row, clue.col));
    focusCell(cellIndex(dims, clue.row, clue.col));
  }

  const filledCount = grid.filter((c, i) => !mask[i] && c !== "" && c !== BLACK).length;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full max-w-xl items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="subtle-text text-xs font-semibold">
            {filledCount}/{filled} filled
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 shadow-[0_3px_0_color-mix(in_srgb,var(--shadow)_10%,transparent)]">
          <span className="text-sm" aria-hidden="true">⏱</span>
          <span className="font-mono text-base font-black tabular-nums">{formatElapsed(elapsedMs)}</span>
        </div>
      </div>

      <div className="flex w-full max-w-xl flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center">
        <div
          className="grid gap-px rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_4px_0_color-mix(in_srgb,var(--shadow)_10%,transparent)]"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: height * width }, (_, index) => {
            if (mask[index]) {
              return <div key={index} className="h-11 w-11 bg-[#1c1f18] sm:h-12 sm:w-12" />;
            }
            const slot = slots.find((s) => s.row === Math.floor(index / width) && s.col === index % width);
            const isActive = activeCells.has(index);
            const isSelected = selected === index;
            return (
              <div key={index} className="relative">
                {slot && (
                  <span className="pointer-events-none absolute left-0.5 top-0 text-[9px] font-black leading-none text-[color-mix(in_srgb,var(--foreground)_55%,transparent)]">
                    {slot.number}
                  </span>
                )}
                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(index, el);
                    else inputRefs.current.delete(index);
                  }}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  disabled={disabled}
                  aria-label={`Row ${Math.floor(index / width) + 1}, column ${(index % width) + 1}`}
                  value={grid[index] === BLACK ? "" : grid[index]}
                  onFocus={() => selectCell(index)}
                  onClick={() => selectCell(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onChange={() => {}}
                  className={[
                    "h-11 w-11 border text-center text-lg font-black uppercase outline-none sm:h-12 sm:w-12",
                    isSelected
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]"
                      : isActive
                        ? "border-[var(--line)] bg-[color-mix(in_srgb,var(--brand-soft)_45%,transparent)]"
                        : "border-[var(--line)] bg-[var(--surface)]",
                  ].join(" ")}
                />
              </div>
            );
          })}
        </div>

        <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-xs sm:max-w-[16rem] sm:grid-cols-1">
          <ClueList label="Across" clues={across} activeSlot={activeSlot} onSelect={(c) => jumpToClue(c, "across")} />
          <ClueList label="Down" clues={down} activeSlot={activeSlot} onSelect={(c) => jumpToClue(c, "down")} />
        </div>
      </div>

      <p className="subtle-text text-center text-xs font-semibold">
        Click a cell or clue to jump there · click again to flip across/down · type to fill
      </p>
    </div>
  );
}

function ClueList({
  label,
  clues,
  activeSlot,
  onSelect,
}: {
  label: string;
  clues: CrosswordClue[];
  activeSlot: CrosswordSlot | undefined;
  onSelect: (clue: CrosswordClue) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="subtle-text mb-1.5 text-[10px] font-extrabold uppercase tracking-widest">{label}</p>
      <ul className="flex flex-col gap-1">
        {clues.map((clue) => {
          const isActive =
            activeSlot?.direction === label.toLowerCase() &&
            activeSlot.row === clue.row &&
            activeSlot.col === clue.col;
          return (
            <li key={clue.number}>
              <button
                type="button"
                onClick={() => onSelect(clue)}
                className={`block w-full rounded-lg px-2 py-1 text-left font-semibold leading-snug ${
                  isActive ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span className="mr-1 font-black">{clue.number}.</span>
                {clue.clue}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
