import "server-only";

import { createSupabaseServerClient } from "@/auth/supabase";
import { GameType } from "@/database/generated/client/enums";

/** Safe row returned by the public `api.public_profiles` projection. */
export interface StandingRow {
  id: string;
  /** Public stable key. This is deliberately the username, never Competitor.id. */
  userId: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
}

export interface PublicRatingRow {
  gameType: GameType;
  rating: number;
  ratingDeviation: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PublicPlayer {
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
  isViewer: boolean;
  ratings: PublicRatingRow[];
}

interface ApiPublicProfileRow {
  username: string;
  avatar_url: string | null;
  joined_at: string;
  is_viewer: boolean;
  game_type: string;
  rating: number;
  rating_deviation: number;
  peak_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

function isGameType(value: unknown): value is GameType {
  return value === GameType.SUDOKU || value === GameType.NONOGRAM;
}

function parseProfileRow(value: unknown): ApiPublicProfileRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const numeric = [
    row.rating,
    row.rating_deviation,
    row.peak_rating,
    row.games_played,
    row.wins,
    row.losses,
    row.draws,
  ];
  if (
    typeof row.username !== "string"
    || (typeof row.avatar_url !== "string" && row.avatar_url !== null)
    || typeof row.joined_at !== "string"
    || typeof row.is_viewer !== "boolean"
    || !isGameType(row.game_type)
    || numeric.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) return null;
  return row as unknown as ApiPublicProfileRow;
}

export async function fetchStandings(
  gameType: GameType,
  { take = 50, skip = 0 }: { take?: number; skip?: number } = {},
): Promise<StandingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("api")
    .from("public_profiles")
    .select("username,avatar_url,joined_at,is_viewer,game_type,rating,rating_deviation,peak_rating,games_played,wins,losses,draws")
    .eq("game_type", gameType)
    .gt("games_played", 0)
    .order("rating", { ascending: false })
    .order("games_played", { ascending: false })
    .order("username", { ascending: true })
    .range(skip, Math.max(skip, skip + Math.max(1, take) - 1));
  if (error) throw new Error("Leaderboard data is unavailable");

  return (data ?? []).map(parseProfileRow).filter((row): row is ApiPublicProfileRow => row !== null).map((row) => ({
    id: `${row.game_type}:${row.username}`,
    userId: row.username,
    username: row.username,
    rating: row.rating,
    gamesPlayed: row.games_played,
    wins: row.wins,
  }));
}

export async function countRankedPlayers(gameType: GameType): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .schema("api")
    .from("public_profiles")
    .select("username", { count: "exact", head: true })
    .eq("game_type", gameType)
    .gt("games_played", 0);
  if (error) throw new Error("Leaderboard count is unavailable");
  return count ?? 0;
}

export async function fetchPublicPlayer(username: string): Promise<PublicPlayer | null> {
  // Next already decodes route params. Re-decoding a literal '%' throws.
  const canonical = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,20}$/.test(canonical)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("api")
    .from("public_profiles")
    .select("username,avatar_url,joined_at,is_viewer,game_type,rating,rating_deviation,peak_rating,games_played,wins,losses,draws")
    .eq("username", canonical);
  if (error) throw new Error("Public profile is unavailable");
  const rows = (data ?? []).map(parseProfileRow).filter((row): row is ApiPublicProfileRow => row !== null);
  if (rows.length === 0) return null;
  return {
    username: rows[0].username,
    avatarUrl: rows[0].avatar_url,
    createdAt: new Date(rows[0].joined_at),
    isViewer: rows.some((row) => row.is_viewer),
    ratings: rows.map((row) => ({
      gameType: row.game_type as GameType,
      rating: row.rating,
      ratingDeviation: row.rating_deviation,
      peakRating: row.peak_rating,
      gamesPlayed: row.games_played,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    })),
  };
}

export async function fetchStandingForPlayer(gameType: GameType, username: string) {
  const player = await fetchPublicPlayer(username);
  const rating = player?.ratings.find((row) => row.gameType === gameType);
  if (!player || !rating || rating.gamesPlayed === 0) return null;
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .schema("api")
    .from("public_profiles")
    .select("username", { count: "exact", head: true })
    .eq("game_type", gameType)
    .gt("games_played", 0)
    .gt("rating", rating.rating);
  if (error) throw new Error("Player rank is unavailable");
  return { ...rating, username: player.username, rank: (count ?? 0) + 1 };
}
