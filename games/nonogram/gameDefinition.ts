import { prisma } from "@/database/client";
import { Difficulty, GameType, PuzzleStatus } from "@/database/generated/client/enums";
import type { GameDefinition, PuzzleAssignment } from "@/matchmaking/gameDefinition";
import { decodeGrid, decodePuzzlePayload, encodePuzzlePayload, type NonogramPuzzlePayload } from "./engine";
import { calculateProgress } from "./progress";
import { validateCompletion as validateNonogramCompletion } from "./validator";

function toPayload(nonogram: { width: number; height: number; rowClues: unknown; colClues: unknown }): NonogramPuzzlePayload {
  return {
    width: nonogram.width,
    height: nonogram.height,
    rowClues: nonogram.rowClues as number[][],
    colClues: nonogram.colClues as number[][],
  };
}

async function createMatch(
  difficulty: Difficulty,
  participantUserIds: string[],
): Promise<PuzzleAssignment> {
  const where = {
    gameType: GameType.NONOGRAM,
    difficulty,
    status: PuzzleStatus.PUBLISHED,
  } as const;

  let candidates = await prisma.puzzle.findMany({
    where: { ...where, attempts: { none: { userId: { in: participantUserIds } } } },
    select: { id: true },
  });
  if (candidates.length === 0) {
    candidates = await prisma.puzzle.findMany({ where, select: { id: true } });
  }
  if (candidates.length === 0) {
    throw new Error(`No ${difficulty} Nonogram puzzles available — run "npm run db:seed".`);
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const puzzle = await prisma.puzzle.findUniqueOrThrow({
    where: { id: chosen.id },
    include: { nonogram: true },
  });
  if (!puzzle.nonogram) throw new Error(`Puzzle ${puzzle.id} is missing its Nonogram data`);

  return { puzzleId: puzzle.id, clientPayload: encodePuzzlePayload(toPayload(puzzle.nonogram)) };
}

async function getPuzzlePayload(puzzleId: string): Promise<string> {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    include: { nonogram: true },
  });
  if (!puzzle?.nonogram) throw new Error(`No Nonogram puzzle found for id ${puzzleId}`);
  return encodePuzzlePayload(toPayload(puzzle.nonogram));
}

function validateCompletion(clientPayload: string, submittedPayload: string) {
  return validateNonogramCompletion(decodePuzzlePayload(clientPayload), decodeGrid(submittedPayload));
}

export const nonogramGameDefinition: GameDefinition = {
  gameType: GameType.NONOGRAM,
  createMatch,
  getPuzzlePayload,
  calculateProgress,
  validateCompletion,
};
