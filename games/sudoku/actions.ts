"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { prisma } from "@/database/client";
import { Difficulty, GameType } from "@/database/generated/client/enums";
import {
  assertDifficulty,
  assertDurationMs,
  assertPuzzleId,
  enforceRateLimit,
} from "@/lib/actionGuards";
import { CELL_COUNT } from "./engine";
import { sudokuGameDefinition } from "./gameDefinition";

const GRID_STRING_PATTERN = /^[0-9]{81}$/;

export interface PracticePuzzle {
  puzzleId: string;
  grid: string;
}

/**
 * Picks a puzzle for the signed-in user to practice. Reuses the same
 * createMatch() a ranked match would use (see gameDefinition.ts), which
 * already avoids puzzles this user has attempted before where possible
 * (SPEC §13) — practice and ranked share one puzzle-selection path.
 */
export async function startPracticePuzzle(difficulty: Difficulty): Promise<PracticePuzzle> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  enforceRateLimit("practice:start", user.id);

  const assignment = await sudokuGameDefinition.createMatch(assertDifficulty(difficulty), [user.id]);
  return { puzzleId: assignment.puzzleId, grid: assignment.clientPayload };
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
  // Each call is a puzzle fetch plus a full validation, and would otherwise be
  // an unmetered correctness oracle — including against a puzzle the caller is
  // currently playing in a ranked match.
  enforceRateLimit("practice:submit", user.id);

  if (typeof submittedGridString !== "string" || !GRID_STRING_PATTERN.test(submittedGridString)) {
    throw new Error(`Expected an ${CELL_COUNT}-digit grid string`);
  }
  const duration = assertDurationMs(durationMs);

  const puzzle = await prisma.puzzle.findUnique({
    where: { id: assertPuzzleId(puzzleId) },
    include: { sudoku: true },
  });
  if (!puzzle?.sudoku || puzzle.gameType !== GameType.SUDOKU) {
    throw new Error(`No Sudoku puzzle found for id ${puzzleId}`);
  }

  const result = await sudokuGameDefinition.validateCompletion(puzzleId, submittedGridString);

  await prisma.puzzleAttempt.create({
    data: {
      userId: user.id,
      puzzleId,
      durationMs: duration,
      completed: result.correct,
    },
  });

  return result;
}
