"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { prisma } from "@/database/client";
import { Difficulty, GameType, PuzzleStatus } from "@/database/generated/client/enums";
import { CELL_COUNT, gridFromString } from "./engine";
import { validateCompletion } from "./validator";

const GRID_STRING_PATTERN = /^[0-9]{81}$/;

export interface PracticePuzzle {
  puzzleId: string;
  grid: string;
}

/**
 * Picks a puzzle for the signed-in user to practice, preferring one they
 * haven't attempted before (SPEC §13: "avoid showing the same user the same
 * puzzle repeatedly when possible") and falling back to any match once
 * they've exhausted the pool. Never returns the solution.
 */
export async function startPracticePuzzle(difficulty: Difficulty): Promise<PracticePuzzle> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const where = {
    gameType: GameType.SUDOKU,
    difficulty,
    status: PuzzleStatus.PUBLISHED,
  } as const;

  let candidates = await prisma.puzzle.findMany({
    where: { ...where, attempts: { none: { userId: user.id } } },
    select: { id: true },
  });

  if (candidates.length === 0) {
    candidates = await prisma.puzzle.findMany({ where, select: { id: true } });
  }

  if (candidates.length === 0) {
    throw new Error(`No ${difficulty} Sudoku puzzles available — run "npm run db:seed".`);
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const puzzle = await prisma.puzzle.findUniqueOrThrow({
    where: { id: chosen.id },
    include: { sudoku: true },
  });

  if (!puzzle.sudoku) {
    throw new Error(`Puzzle ${puzzle.id} is missing its Sudoku data`);
  }

  return { puzzleId: puzzle.id, grid: puzzle.sudoku.grid };
}

export interface SubmitResult {
  complete: boolean;
  correct: boolean;
}

/**
 * Authoritative completion check: re-derives correctness from the puzzle's
 * given cells (never the stored solution — see validator.ts). `durationMs`
 * is client-reported and only used for the practice record, not anything
 * rating-affecting, so it isn't independently verified here.
 */
export async function submitPracticeSolution(
  puzzleId: string,
  submittedGridString: string,
  durationMs: number,
): Promise<SubmitResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!GRID_STRING_PATTERN.test(submittedGridString)) {
    throw new Error(`Expected an ${CELL_COUNT}-digit grid string`);
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error("Invalid duration");
  }

  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    include: { sudoku: true },
  });
  if (!puzzle?.sudoku || puzzle.gameType !== GameType.SUDOKU) {
    throw new Error(`No Sudoku puzzle found for id ${puzzleId}`);
  }

  const result = validateCompletion(
    gridFromString(puzzle.sudoku.grid),
    gridFromString(submittedGridString),
  );

  await prisma.puzzleAttempt.create({
    data: {
      userId: user.id,
      puzzleId,
      durationMs: Math.round(durationMs),
      completed: result.correct,
    },
  });

  return result;
}
