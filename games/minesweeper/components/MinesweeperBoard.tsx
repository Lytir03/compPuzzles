"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatElapsed } from "@/lib/formatElapsed";
import {
  FLAGGED,
  HIDDEN,
  adjacentMineCount,
  neighbors,
  type MineMap,
  type MinesweeperDimensions,
  type MinesweeperView,
} from "../engine";

export interface MinesweeperBoardProps extends MinesweeperDimensions {
  mines: MineMap;
  mineCount: number;
  openingCell: number;
  onFinish: (won: boolean, elapsedMs: number) => void;
}

const LONG_PRESS_MS = 420;

function revealSafeCells(
  view: MinesweeperView,
  mines: MineMap,
  dims: MinesweeperDimensions,
  initialCells: number[],
): MinesweeperView {
  const next = [...view];
  const queue = [...initialCells];

  while (queue.length > 0) {
    const cell = queue.pop()!;
    if (next[cell] !== HIDDEN || mines[cell]) continue;
    const count = adjacentMineCount(mines, dims, cell);
    next[cell] = count;
    if (count === 0) {
      neighbors(dims, cell).forEach((neighbor) => {
        if (next[neighbor] === HIDDEN && !mines[neighbor]) queue.push(neighbor);
      });
    }
  }

  return next;
}

function numberTone(value: number): string {
  return [
    "",
    "text-[#3478c7]",
    "text-[#458b31]",
    "text-[#d25346]",
    "text-[#7254b8]",
    "text-[#a05b28]",
    "text-[#23848a]",
    "text-[#353932]",
    "text-[#777c72]",
  ][value];
}

export function MinesweeperBoard({
  width,
  height,
  mines,
  mineCount,
  openingCell,
  onFinish,
}: MinesweeperBoardProps) {
  const dims = useMemo(() => ({ width, height }), [width, height]);
  const [view, setView] = useState<MinesweeperView>(() =>
    revealSafeCells(new Array(mines.length).fill(HIDDEN), mines, dims, [openingCell]),
  );
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [explodedCell, setExplodedCell] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const reportedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const flagsPlaced = view.filter((cell) => cell === FLAGGED).length;
  const safeCellsLeft = view.filter(
    (cell, index) => !mines[index] && (cell === HIDDEN || cell === FLAGGED),
  ).length;

  useEffect(() => {
    startRef.current ??= Date.now();
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(
      () => setElapsedMs(Date.now() - (startRef.current ?? Date.now())),
      250,
    );
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === "playing" || reportedRef.current) return;
    reportedRef.current = true;
    onFinish(status === "won", Date.now() - (startRef.current ?? Date.now()));
  }, [status, onFinish]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  function checkForWin(next: MinesweeperView) {
    const cleared = next.every((cell, index) => mines[index] || (cell !== HIDDEN && cell !== FLAGGED));
    if (cleared) setStatus("won");
  }

  function reveal(index: number) {
    if (status !== "playing" || view[index] === FLAGGED) return;

    if (view[index] >= 0) {
      const adjacent = neighbors(dims, index);
      const adjacentFlags = adjacent.filter((cell) => view[cell] === FLAGGED).length;
      if (adjacentFlags !== view[index]) return;
      const hiddenNeighbors = adjacent.filter((cell) => view[cell] === HIDDEN);
      const mine = hiddenNeighbors.find((cell) => mines[cell]);
      if (mine !== undefined) {
        setExplodedCell(mine);
        setStatus("lost");
        return;
      }
      const next = revealSafeCells(view, mines, dims, hiddenNeighbors);
      setView(next);
      checkForWin(next);
      return;
    }

    if (mines[index]) {
      setExplodedCell(index);
      setStatus("lost");
      return;
    }

    const next = revealSafeCells(view, mines, dims, [index]);
    setView(next);
    checkForWin(next);
  }

  function toggleFlag(index: number) {
    if (status !== "playing" || view[index] >= 0) return;
    setView((current) => {
      const next = [...current];
      next[index] = current[index] === FLAGGED ? HIDDEN : FLAGGED;
      return next;
    });
  }

  function handlePointerDown(index: number) {
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      toggleFlag(index);
    }, LONG_PRESS_MS);
  }

  function handlePointerEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  const cellSize = width <= 9 ? "clamp(2.35rem, 9vw, 2.9rem)" : "clamp(1.75rem, 6vw, 2.15rem)";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[0_3px_0_color-mix(in_srgb,var(--shadow)_10%,transparent)]">
        <span className="flex items-center gap-2 font-black">
          <span aria-hidden="true">✹</span>
          <span className="font-mono tabular-nums">{Math.max(0, mineCount - flagsPlaced)}</span>
        </span>
        <span className="rounded-lg bg-[var(--surface-muted)] px-3 py-1 font-mono text-sm font-black tabular-nums">
          {formatElapsed(elapsedMs)}
        </span>
        <span className="text-xs font-extrabold text-[var(--brand-text)]">
          {safeCellsLeft} safe left
        </span>
      </div>

      <div className="max-w-full overflow-auto rounded-2xl border-2 border-[#777a70] bg-[#d8ddd4] p-1.5 shadow-[0_5px_0_#b6bbb2,0_14px_28px_rgba(37,41,31,.12)]">
        <div
          role="grid"
          aria-label={`${width} by ${height} Minesweeper board`}
          className="grid w-fit gap-px bg-[#8d9086]"
          style={{
            gridTemplateColumns: `repeat(${width}, var(--mine-cell))`,
            ["--mine-cell" as string]: cellSize,
          }}
        >
          {view.map((cell, index) => {
            const revealedMine = status === "lost" && mines[index];
            const exploded = explodedCell === index;
            const revealed = cell >= 0;
            const label = revealedMine
              ? "Mine"
              : cell === FLAGGED
                ? "Flagged cell"
                : revealed
                  ? cell === 0
                    ? "Empty cell"
                    : `${cell} adjacent mines`
                  : "Hidden cell";

            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                aria-label={`Row ${Math.floor(index / width) + 1}, column ${index % width + 1}, ${label.toLowerCase()}`}
                disabled={status !== "playing"}
                onClick={() => {
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false;
                    return;
                  }
                  reveal(index);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleFlag(index);
                }}
                onPointerDown={(event) => {
                  if (event.button === 0) handlePointerDown(index);
                }}
                onKeyDown={(event) => {
                  if (event.key.toLowerCase() === "f") {
                    event.preventDefault();
                    toggleFlag(index);
                  }
                }}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
                className={`grid aspect-square touch-manipulation place-items-center text-sm font-black transition sm:text-base ${
                  exploded
                    ? "bg-[#e7584d] text-white"
                    : revealedMine
                      ? "bg-[#ffd8d3] text-[#9f3027]"
                      : cell === FLAGGED
                        ? "bg-[#f6ca65] text-[#604708] shadow-[inset_0_-3px_0_#d4a437]"
                        : revealed
                          ? `bg-[#f8f7f1] ${numberTone(cell)}`
                          : "bg-[#6f9bb8] text-white shadow-[inset_0_-4px_0_#49728d] hover:bg-[#82abc5] active:translate-y-px active:shadow-[inset_0_-2px_0_#49728d]"
                }`}
              >
                {revealedMine ? "✹" : cell === FLAGGED ? "⚑" : revealed && cell > 0 ? cell : ""}
              </button>
            );
          })}
        </div>
      </div>

      <p className="subtle-text max-w-lg text-center text-xs font-semibold leading-5">
        Tap to clear · right-click, hold or press F to flag · tap a revealed number to clear around it once its flags match
      </p>
    </div>
  );
}
