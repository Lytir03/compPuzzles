"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/database/client";
import { GameType } from "@/database/generated/client/enums";
import {
  INITIAL_RATING,
  INITIAL_RATING_DEVIATION,
  INITIAL_VOLATILITY,
} from "@/rating/constants";
import { setSessionUserId } from "./session";

const ALL_GAME_TYPES = [GameType.SUDOKU, GameType.CROSSWORD, GameType.NONOGRAM];
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * Local-only "login": no password. Typing an existing username signs in as
 * that user — fine for one developer testing solo across two browser
 * sessions, not a real auth model. Swap this out (along with session.ts /
 * currentUser.ts) when Clerk is reintroduced for a non-local deployment.
 */
export async function loginWithUsername(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  if (!USERNAME_PATTERN.test(username)) {
    redirect("/sign-in?error=invalid-username");
  }

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username },
  });

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

  await setSessionUserId(user.id);
  redirect("/dashboard");
}
