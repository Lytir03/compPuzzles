"use server";

import { Difficulty } from "@/database/generated/client/enums";
import type { RankedModeId } from "@/games/modes";
import { requestPracticeAssignment, submitPracticeAssignment } from "@/lib/practiceApi";
import { decodeGrid } from "./engine";

const MODE_BY_DIFFICULTY: Partial<Record<Difficulty, RankedModeId>> = {
  [Difficulty.EASY]: "NONOGRAM_5X5",
  [Difficulty.MEDIUM]: "NONOGRAM_10X10",
};

export interface PracticePuzzle {
  assignmentId: string;
  payload: string;
}

export async function startPracticePuzzle(difficulty: Difficulty): Promise<PracticePuzzle> {
  const modeId = MODE_BY_DIFFICULTY[difficulty];
  if (!modeId) throw new Error("Unsupported Nonogram practice mode.");
  const assignment = await requestPracticeAssignment(modeId);
  return { assignmentId: assignment.assignmentId, payload: assignment.payload };
}

export interface SubmitResult {
  complete: boolean;
  correct: boolean;
}

export async function submitPracticeSolution(
  assignmentId: string,
  submittedGridPayload: string,
  _clientDurationMs: number,
): Promise<SubmitResult> {
  void _clientDurationMs;
  if (typeof submittedGridPayload !== "string" || submittedGridPayload.length > 16_384) {
    throw new Error("Malformed grid payload");
  }
  try {
    decodeGrid(submittedGridPayload);
  } catch {
    throw new Error("Malformed grid payload");
  }
  return submitPracticeAssignment(assignmentId, submittedGridPayload);
}
