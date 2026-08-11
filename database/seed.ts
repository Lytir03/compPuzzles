import { gridToString } from "@/games/sudoku/engine";
import { generatePuzzle as generateSudokuPuzzle } from "@/games/sudoku/generator";
import { generatePuzzle as generateNonogramPuzzle } from "@/games/nonogram/generator";
import { prisma } from "./client";
import { Difficulty, GameType, PuzzleStatus } from "./generated/client/enums";

// SPEC §14 example is "100 Easy, 100 Medium, 100 Hard" for dev/testing.
// Default lower for a fast everyday `npm run db:seed`; override with
// SUDOKU_PUZZLES_PER_DIFFICULTY=100 npm run db:seed to match the example.
const SUDOKU_TARGET_PER_DIFFICULTY = Number(process.env.SUDOKU_PUZZLES_PER_DIFFICULTY ?? 20);
const NONOGRAM_TARGET_PER_DIFFICULTY = Number(process.env.NONOGRAM_PUZZLES_PER_DIFFICULTY ?? 20);

async function topUpSudokuPuzzles(difficulty: Difficulty) {
  const existing = await prisma.puzzle.count({
    where: { gameType: GameType.SUDOKU, difficulty, status: PuzzleStatus.PUBLISHED },
  });
  const toGenerate = SUDOKU_TARGET_PER_DIFFICULTY - existing;
  if (toGenerate <= 0) {
    console.log(`Sudoku ${difficulty}: already have ${existing}, skipping.`);
    return;
  }

  console.log(`Sudoku ${difficulty}: generating ${toGenerate} more (have ${existing})...`);
  for (let i = 0; i < toGenerate; i++) {
    const { grid, solution, clueCount } = generateSudokuPuzzle(difficulty);
    await prisma.puzzle.create({
      data: {
        gameType: GameType.SUDOKU,
        difficulty,
        sudoku: {
          create: {
            grid: gridToString(grid),
            solution: gridToString(solution),
            difficultyScore: clueCount,
          },
        },
      },
    });
    if ((i + 1) % 10 === 0 || i + 1 === toGenerate) {
      console.log(`  ${difficulty}: ${i + 1}/${toGenerate}`);
    }
  }
}

async function topUpNonogramPuzzles(difficulty: Difficulty) {
  const existing = await prisma.puzzle.count({
    where: { gameType: GameType.NONOGRAM, difficulty, status: PuzzleStatus.PUBLISHED },
  });
  const toGenerate = NONOGRAM_TARGET_PER_DIFFICULTY - existing;
  if (toGenerate <= 0) {
    console.log(`Nonogram ${difficulty}: already have ${existing}, skipping.`);
    return;
  }

  console.log(`Nonogram ${difficulty}: generating ${toGenerate} more (have ${existing})...`);
  for (let i = 0; i < toGenerate; i++) {
    const { dims, solution, rowClues, colClues } = generateNonogramPuzzle(difficulty);
    await prisma.puzzle.create({
      data: {
        gameType: GameType.NONOGRAM,
        difficulty,
        nonogram: {
          create: {
            width: dims.width,
            height: dims.height,
            rowClues,
            colClues,
            solutionGrid: solution,
          },
        },
      },
    });
    if ((i + 1) % 10 === 0 || i + 1 === toGenerate) {
      console.log(`  ${difficulty}: ${i + 1}/${toGenerate}`);
    }
  }
}

async function main() {
  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    await topUpSudokuPuzzles(difficulty);
  }
  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    await topUpNonogramPuzzles(difficulty);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
