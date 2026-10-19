import { prisma } from "@/database/client";
import { Difficulty, GameType, PuzzleStatus } from "@/database/generated/client/enums";
import type { GameDefinition, PuzzleAssignment } from "@/matchmaking/gameDefinition";
import {
  type CrosswordClue,
  type CrosswordGrid,
  type CrosswordPuzzlePayload,
  decodeGrid,
  encodePuzzlePayload,
} from "./engine";
import { calculateProgress } from "./progress";
import { validateCompletion as validateCrosswordCompletion } from "./validator";

function toPayload(puzzle: {
  title: string;
  width: number;
  height: number;
  grid: unknown;
  clues: unknown;
}): CrosswordPuzzlePayload {
  const mask = puzzle.grid as boolean[];
  const clues = puzzle.clues as { across: CrosswordClue[]; down: CrosswordClue[] };
  return {
    title: puzzle.title,
    width: puzzle.width,
    height: puzzle.height,
    mask,
    across: clues.across,
    down: clues.down,
  };
}

async function createMatch(
  difficulty: Difficulty,
  _participantCompetitorIds: string[],
): Promise<PuzzleAssignment> {
  void _participantCompetitorIds;
  const where = {
    gameType: GameType.CROSSWORD,
    difficulty,
    status: PuzzleStatus.PUBLISHED,
  } as const;

  const candidates = await prisma.puzzle.findMany({ where, select: { id: true } });
  if (candidates.length === 0) {
    throw new Error(`No ${difficulty} Crossword puzzles available — run "npm run db:seed".`);
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const puzzle = await prisma.puzzle.findUniqueOrThrow({
    where: { id: chosen.id },
    include: { crossword: true },
  });
  if (!puzzle.crossword) throw new Error(`Puzzle ${puzzle.id} is missing its Crossword data`);

  return { puzzleId: puzzle.id, clientPayload: encodePuzzlePayload(toPayload(puzzle.crossword)) };
}

async function getPuzzlePayload(puzzleId: string): Promise<string> {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    include: { crossword: true },
  });
  if (!puzzle?.crossword) throw new Error(`No Crossword puzzle found for id ${puzzleId}`);
  return encodePuzzlePayload(toPayload(puzzle.crossword));
}

async function validateCompletion(puzzleId: string, submittedPayload: string) {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    include: { crossword: { include: { secret: true } } },
  });
  if (!puzzle?.crossword) throw new Error(`No Crossword puzzle found for id ${puzzleId}`);
  if (!puzzle.crossword.secret) throw new Error(`Crossword ${puzzleId} has no private answer key`);
  const solution = puzzle.crossword.secret.answers as CrosswordGrid;
  return validateCrosswordCompletion(solution, decodeGrid(submittedPayload));
}

export const crosswordGameDefinition: GameDefinition = {
  gameType: GameType.CROSSWORD,
  createMatch,
  getPuzzlePayload,
  calculateProgress,
  validateCompletion,
};
