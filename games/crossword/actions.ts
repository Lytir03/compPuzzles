"use server";

import type { Difficulty } from "@/database/generated/client/enums";

export interface PracticePuzzle {
  assignmentId: string;
  payload: string;
}

export interface SubmitResult {
  complete: boolean;
  correct: boolean;
}

/** Crossword content is archived and cannot be reached through forged actions. */
export async function startPracticePuzzle(_difficulty: Difficulty): Promise<PracticePuzzle> {
  void _difficulty;
  throw new Error("Crossword is not an available game mode.");
}

export async function submitPracticeSolution(
  _assignmentId: string,
  _submittedGridPayload: string,
  _clientDurationMs: number,
): Promise<SubmitResult> {
  void _assignmentId;
  void _submittedGridPayload;
  void _clientDurationMs;
  throw new Error("Crossword is not an available game mode.");
}
