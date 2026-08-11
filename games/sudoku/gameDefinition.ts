import { prisma } from "@/database/client";
import { Difficulty, GameType, PuzzleStatus } from "@/database/generated/client/enums";
import type { GameDefinition, PuzzleAssignment } from "@/matchmaking/gameDefinition";
import { gridFromString } from "./engine";
import { calculateProgress } from "./progress";
import { validateCompletion as validateSudokuCompletion } from "./validator";

async function createMatch(
  difficulty: Difficulty,
  participantUserIds: string[],
): Promise<PuzzleAssignment> {
  const where = {
    gameType: GameType.SUDOKU,
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
    throw new Error(`No ${difficulty} Sudoku puzzles available — run "npm run db:seed".`);
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const puzzle = await prisma.puzzle.findUniqueOrThrow({
    where: { id: chosen.id },
    include: { sudoku: true },
  });
  if (!puzzle.sudoku) throw new Error(`Puzzle ${puzzle.id} is missing its Sudoku data`);

  return { puzzleId: puzzle.id, clientPayload: puzzle.sudoku.grid };
}

async function getPuzzlePayload(puzzleId: string): Promise<string> {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    include: { sudoku: true },
  });
  if (!puzzle?.sudoku) throw new Error(`No Sudoku puzzle found for id ${puzzleId}`);
  return puzzle.sudoku.grid;
}

function validateCompletion(clientPayload: string, submittedPayload: string) {
  return validateSudokuCompletion(gridFromString(clientPayload), gridFromString(submittedPayload));
}

export const sudokuGameDefinition: GameDefinition = {
  gameType: GameType.SUDOKU,
  createMatch,
  getPuzzlePayload,
  calculateProgress,
  validateCompletion,
};
