import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/database/client";
import { GameType } from "@/database/generated/client/enums";
import {
  INITIAL_RATING,
  INITIAL_RATING_DEVIATION,
  INITIAL_VOLATILITY,
} from "@/rating/constants";

const ALL_GAME_TYPES = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];

function deriveUsername(clerkUsername: string | null, email: string, clerkId: string) {
  if (clerkUsername) return clerkUsername;
  const localPart = email.split("@")[0] || "player";
  return `${localPart}-${clerkId.slice(-6)}`;
}

/**
 * Lazily syncs the signed-in Clerk identity into our own User +
 * PlayerGameRating rows. Called on every dashboard load; idempotent after
 * the first call. See docs/SPEC.md §8 for why we don't use a Clerk webhook
 * for this in Phase 1 (no public endpoint to receive it on localhost).
 */
export async function ensureUserProfile() {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("ensureUserProfile called without an authenticated Clerk user");
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const avatarUrl = clerkUser.hasImage ? clerkUser.imageUrl : null;

  // Username derivation can collide across two different Clerk users landing
  // on the same email local-part; retry once with a clerkId-suffixed name
  // rather than letting the @@unique constraint throw an unhandled error.
  const candidateUsername = deriveUsername(clerkUser.username, email, clerkUser.id);

  const user = await upsertUser(clerkUser.id, email, avatarUrl, candidateUsername).catch(
    async (error) => {
      if (isUniqueUsernameConflict(error)) {
        return upsertUser(
          clerkUser.id,
          email,
          avatarUrl,
          `${candidateUsername}-${Math.random().toString(36).slice(2, 6)}`,
        );
      }
      throw error;
    },
  );

  await Promise.all(
    ALL_GAME_TYPES.map((gameType) =>
      prisma.playerGameRating.upsert({
        where: { userId_gameType: { userId: user.id, gameType } },
        update: {},
        create: {
          userId: user.id,
          gameType,
          rating: INITIAL_RATING,
          ratingDeviation: INITIAL_RATING_DEVIATION,
          volatility: INITIAL_VOLATILITY,
          peakRating: INITIAL_RATING,
        },
      }),
    ),
  );

  const ratings = await prisma.playerGameRating.findMany({
    where: { userId: user.id },
  });

  return { user, ratings };
}

function upsertUser(clerkId: string, email: string, avatarUrl: string | null, username: string) {
  return prisma.user.upsert({
    where: { clerkId },
    update: { email, avatarUrl },
    create: { clerkId, email, avatarUrl, username },
  });
}

function isUniqueUsernameConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
