/*
  Warnings:

  - Added the required column `difficulty` to the `MatchmakingQueueEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MatchmakingQueueEntry_gameType_queuedAt_idx";

-- AlterTable
ALTER TABLE "MatchmakingQueueEntry" ADD COLUMN     "difficulty" "Difficulty" NOT NULL;

-- CreateIndex
CREATE INDEX "MatchmakingQueueEntry_gameType_difficulty_queuedAt_idx" ON "MatchmakingQueueEntry"("gameType", "difficulty", "queuedAt");
