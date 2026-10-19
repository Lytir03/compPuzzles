import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCrosswordImport, type CrosswordImportPuzzle } from "@/games/crossword/importFormat";
import { gridToString } from "@/games/sudoku/engine";
import {
  SUDOKU_VARIANTS,
  generatePuzzle as generateSudokuPuzzle,
} from "@/games/sudoku/generator";
import { generatePuzzle as generateNonogramPuzzle } from "@/games/nonogram/generator";
import { SUPPORTED_NONOGRAM_DIFFICULTIES } from "@/games/nonogram/generator";
import { prisma } from "./client";
import { Difficulty, GameType, PuzzleStatus } from "./generated/client/enums";

// SPEC §14 example is "100 Easy, 100 Medium, 100 Hard" for dev/testing.
// Default lower for a fast everyday `npm run db:seed`; override with
// SUDOKU_PUZZLES_PER_DIFFICULTY=100 npm run db:seed to match the example.
const SUDOKU_TARGET_PER_DIFFICULTY = Number(process.env.SUDOKU_PUZZLES_PER_DIFFICULTY ?? 20);
const NONOGRAM_TARGET_PER_DIFFICULTY = Number(process.env.NONOGRAM_PUZZLES_PER_DIFFICULTY ?? 20);

async function topUpSudokuPuzzles(difficulty: Difficulty) {
  const existing = await prisma.puzzle.count({
    where: {
      gameType: GameType.SUDOKU,
      difficulty,
      status: PuzzleStatus.PUBLISHED,
      metadata: { path: ["variant"], equals: SUDOKU_VARIANTS[difficulty] },
    },
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
        metadata: { variant: SUDOKU_VARIANTS[difficulty] },
        sudoku: {
          create: {
            grid: gridToString(grid),
            difficultyScore: clueCount,
            secret: { create: { solution: gridToString(solution) } },
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
            secret: { create: { solutionGrid: solution } },
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
        status: PuzzleStatus.ARCHIVED,
        crossword: {
          create: {
            title: parsed.title,
            width: parsed.width,
            height: parsed.height,
            grid: parsed.mask,
            clues: { across: parsed.across, down: parsed.down },
            secret: { create: { answers: parsed.solution } },
            author: parsed.author,
            source: parsed.source,
          },
        },
      },
    });
    console.log(`Crossword "${parsed.title}": imported.`);
  }
}

// Demo-only bot opponent (see realtime/bot.ts). Created through Supabase's
// own signup pipeline — same user_metadata shape as auth/actions.ts:signUp —
// so the existing on_auth_user_change trigger creates its Competitor,
// AccountProfile and PlayerGameRating rows exactly like a real signup would.
// No schema change, and Prisma never touches auth here directly.
async function seedBotAccount() {
  if (process.env.NODE_ENV === "production") return;

  const usernameCanonical = process.env.MATCHMAKING_BOT_USERNAME?.trim() || "puzzle_bot";
  const existing = await prisma.accountProfile.findUnique({ where: { usernameCanonical } });
  if (existing) {
    console.log(`Bot account "${usernameCanonical}": already seeded, skipping.`);
    return;
  }

  let apiUrl: string;
  let secretKey: string;
  try {
    const statusOutput = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
    const local = Object.fromEntries(
      statusOutput
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z0-9_]+)="(.*)"$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => [match[1], match[2]]),
    );
    if (!local.API_URL || !local.SECRET_KEY) throw new Error("missing API_URL/SECRET_KEY");
    apiUrl = local.API_URL;
    secretKey = local.SECRET_KEY;
  } catch {
    console.log(`Bot account "${usernameCanonical}": local Supabase isn't running, skipping (run \`npm run db:start\` first for the bot fallback demo).`);
    return;
  }

  const termsVersion = process.env.CURRENT_TERMS_VERSION?.trim();
  if (!termsVersion) {
    console.log(`Bot account "${usernameCanonical}": CURRENT_TERMS_VERSION isn't set, skipping.`);
    return;
  }

  const admin = createClient(apiUrl, secretKey);
  const now = new Date().toISOString();
  const { error } = await admin.auth.admin.createUser({
    email: `${usernameCanonical}@bot.comppuzzles.invalid`,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      username: usernameCanonical,
      username_canonical: usernameCanonical,
      terms_version: termsVersion,
      terms_accepted_at: now,
      age_attested_at: now,
    },
  });
  if (error) {
    console.error(`Bot account "${usernameCanonical}": failed to create —`, error.message);
    return;
  }
  console.log(`Bot account "${usernameCanonical}": created.`);
}

async function main() {
  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    await topUpSudokuPuzzles(difficulty);
  }
  for (const difficulty of SUPPORTED_NONOGRAM_DIFFICULTIES) {
    await topUpNonogramPuzzles(difficulty);
  }
  await importCrosswordPuzzles();
  await seedBotAccount();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
