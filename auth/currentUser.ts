import "server-only";

import type { GameType } from "@/database/generated/client/enums";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "./cookies";
import { createSupabaseServerClient } from "./supabase";
import { isEmailVerified } from "./session";

const ACTIVE_GAME_TYPES = new Set<GameType>(["SUDOKU", "NONOGRAM"]);

export interface CurrentUserRating {
  gameType: GameType;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface CurrentUser {
  /** Server-only viewer key; competitive UUIDs never cross the Data API. */
  id: string;
  authUserId: string;
  username: string;
  avatarUrl: string | null;
  ratings: CurrentUserRating[];
}

interface ProfileRow {
  username: string;
  avatar_url: string | null;
  competitor_status: string;
}

interface RatingRow {
  game_type: string;
  rating: number;
  rating_deviation: number;
  volatility: number;
  peak_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

function isProfileRow(value: unknown): value is ProfileRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.username === "string"
    && (typeof row.avatar_url === "string" || row.avatar_url === null)
    && row.competitor_status === "ACTIVE";
}

function parseRating(value: unknown): CurrentUserRating | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<RatingRow>;
  if (!ACTIVE_GAME_TYPES.has(row.game_type as GameType)) return null;
  const numbers = [
    row.rating,
    row.rating_deviation,
    row.volatility,
    row.peak_rating,
    row.games_played,
    row.wins,
    row.losses,
    row.draws,
  ];
  if (numbers.some((item) => typeof item !== "number" || !Number.isFinite(item))) return null;
  return {
    gameType: row.game_type as GameType,
    rating: row.rating!,
    ratingDeviation: row.rating_deviation!,
    volatility: row.volatility!,
    peakRating: row.peak_rating!,
    gamesPlayed: row.games_played!,
    wins: row.wins!,
    losses: row.losses!,
    draws: row.draws!,
  };
}
/**
 * Resolves a verified Supabase identity through user-scoped Data API views.
 * There is deliberately no Prisma/DATABASE_URL import in the Netlify BFF.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Anonymous pages (and Next's build-time prerender) must not initialize the
  // runtime-only Supabase client. This keeps Netlify builds free of auth
  // secrets while authenticated requests and all auth actions still validate
  // the complete production environment before use.
  const cookieStore = await cookies();
  if (!cookieStore.getAll().some(({ name }) => name.startsWith(AUTH_COOKIE_NAME))) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user || !isEmailVerified(auth.data.user)) return null;

  const [profileResult, ratingsResult] = await Promise.all([
    supabase
      .schema("api")
      .from("my_account_profile")
      .select("username,avatar_url,competitor_status")
      .maybeSingle(),
    supabase
      .schema("api")
      .from("my_game_ratings")
      .select("game_type,rating,rating_deviation,volatility,peak_rating,games_played,wins,losses,draws"),
  ]);

  if (profileResult.error || ratingsResult.error) {
    throw new Error("Authenticated account data is unavailable");
  }
  if (!isProfileRow(profileResult.data)) {
    return null;
  }

  const ratings = (ratingsResult.data ?? []).map(parseRating).filter((row): row is CurrentUserRating => row !== null);
  return {
    id: auth.data.user.id,
    authUserId: auth.data.user.id,
    username: profileResult.data.username,
    avatarUrl: profileResult.data.avatar_url,
    ratings,
  };
}
