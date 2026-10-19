"use server";

import { Difficulty } from "@/database/generated/client/enums";
import type { RankedModeId } from "@/games/modes";
import { requestPracticeAssignment, submitPracticeAssignment } from "@/lib/practiceApi";

const GRID_STRING_PATTERN = /^(?:[0-6]{36}|[0-9]{81})$/;

const MODE_BY_DIFFICULTY: Record<Difficulty, RankedModeId> = {
  [Difficulty.EASY]: "SUDOKU_6X6_CHALLENGE",
  [Difficulty.MEDIUM]: "SUDOKU_9X9_EASY",
  [Difficulty.HARD]: "SUDOKU_9X9_HARD",
};

export interface PracticePuzzle {
  assignmentId: string;
  grid: string;
}

export async function startPracticePuzzle(difficulty: Difficulty): Promise<PracticePuzzle> {
  const modeId = MODE_BY_DIFFICULTY[difficulty];
  if (!modeId) throw new Error("Unsupported Sudoku practice mode.");
  const assignment = await requestPracticeAssignment(modeId);
  if (!GRID_STRING_PATTERN.test(assignment.payload)) throw new Error("Invalid Sudoku assignment.");
  return { assignmentId: assignment.assignmentId, grid: assignment.payload };
}

export interface SubmitResult {
  complete: boolean;
  correct: boolean;
}

export async function submitPracticeSolution(
  assignmentId: string,
  submittedGridString: string,
  _clientDurationMs: number,
): Promise<SubmitResult> {
  void _clientDurationMs;
  if (!GRID_STRING_PATTERN.test(submittedGridString)) {
    throw new Error("Expected a valid 36-cell Blitz or 81-cell classic Sudoku grid");
  }
  return submitPracticeAssignment(assignmentId, submittedGridString);
}
