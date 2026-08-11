import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseCrosswordImport, type CrosswordImportPuzzle } from "@/games/crossword/importFormat";
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

// Crossword is curated content, not procedural (SPEC §16 explicitly rules
// out a "sophisticated crossword generator") — this imports every JSON file
// in games/crossword/content/ through the same parseCrosswordImport() a
// future admin-upload path would use, idempotent by title so re-running
// `npm run db:seed` never creates duplicates.
async function importCrosswordPuzzles() {
  const contentDir = path.join(process.cwd(), "games/crossword/content");
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const raw = JSON.parse(readFileSync(path.join(contentDir, file), "utf8")) as CrosswordImportPuzzle;
    const parsed = parseCrosswordImport(raw);

    const existing = await prisma.crosswordPuzzle.findFirst({ where: { title: parsed.title } });
    if (existing) {
      console.log(`Crossword "${parsed.title}": already imported, skipping.`);
      continue;
    }

    await prisma.puzzle.create({
      data: {
        gameType: GameType.CROSSWORD,
        difficulty: parsed.difficulty,
        crossword: {
          create: {
            title: parsed.title,
            width: parsed.width,
            height: parsed.height,
            grid: parsed.mask,
            clues: { across: parsed.across, down: parsed.down },
            answers: parsed.solution,
            author: parsed.author,
            source: parsed.source,
          },
        },
      },
    });
    console.log(`Crossword "${parsed.title}": imported.`);
  }
}

async function main() {
  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    await topUpSudokuPuzzles(difficulty);
  }
  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    await topUpNonogramPuzzles(difficulty);
  }
  await importCrosswordPuzzles();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
