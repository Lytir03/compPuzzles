import { prisma } from "./client";

// No seed data yet — puzzle seeding (Sudoku batches, demo crosswords, etc.)
// arrives in Phase 2+. This stub exists so `npm run db:seed` is a real,
// working command from Phase 1 onward instead of a no-op placeholder.
async function main() {
  console.log("Nothing to seed yet (Phase 1).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
