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
import { decodeGrid, isValidGrid } from "./engine";
import { crosswordGameDefinition } from "./gameDefinition";

export interface PracticePuzzle {
  puzzleId: string;
  /** JSON-encoded CrosswordPuzzlePayload — see engine.ts. */
  payload: string;
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

  const assignment = await crosswordGameDefinition.createMatch(assertDifficulty(difficulty), [user.id]);
  return { puzzleId: assignment.puzzleId, payload: assignment.clientPayload };
}

export interface SubmitResult {
  complete: boolean;
  correct: boolean;
}

/**
 * Authoritative completion check: compares against the stored solution grid
 * (see validator.ts — unlike Sudoku/Nonogram, a crossword can't self-verify
 * from the black-square layout alone). `durationMs` is client-reported and
 * only used for the practice record, not anything rating-affecting, so it
 * isn't independently verified here.
 */
export async function submitPracticeSolution(
  puzzleId: string,
  submittedGridPayload: string,
  durationMs: number,
): Promise<SubmitResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Each call is a puzzle fetch plus a full validation against the stored
  // answer key, and would otherwise be an unmetered correctness oracle —
  // including against a puzzle the caller is currently playing in a ranked match.
  enforceRateLimit("practice:submit", user.id);

  const duration = assertDurationMs(durationMs);
  if (typeof submittedGridPayload !== "string") {
    throw new Error("Malformed grid payload");
  }

  const puzzle = await prisma.puzzle.findUnique({
    where: { id: assertPuzzleId(puzzleId) },
    include: { crossword: true },
  });
  if (!puzzle?.crossword || puzzle.gameType !== GameType.CROSSWORD) {
    throw new Error(`No Crossword puzzle found for id ${puzzleId}`);
  }

  let grid: unknown;
  try {
    grid = decodeGrid(submittedGridPayload);
  } catch {
    throw new Error("Malformed grid payload");
  }
  const mask = puzzle.crossword.grid as boolean[];
  if (!isValidGrid(grid, { width: puzzle.crossword.width, height: puzzle.crossword.height }, mask)) {
    throw new Error("Invalid grid payload");
  }

  const result = await crosswordGameDefinition.validateCompletion(puzzleId, submittedGridPayload);

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
