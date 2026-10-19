import "server-only";

import { createSupabaseServerClient } from "@/auth/supabase";
import {
  Difficulty,
  GameType,
  MatchResult,
} from "@/database/generated/client/enums";

export interface MatchHistoryRow {
  id: string;
  matchId: string;
  gameType: GameType;
  difficulty: Difficulty;
  result: MatchResult | null;
  opponentUsername: string | null;
  ratingDelta: number | null;
  ratingAfter: number | null;
  completionTimeMs: number | null;
  opponentCompletionTimeMs: number | null;
  mistakes: number | null;
  completedAt: Date | null;
}

export interface MatchHistoryQuery {
  take?: number;
  skip?: number;
  gameType?: GameType;
}

interface HistoryApiRow {
  match_id: string;
  game_type: GameType;
  difficulty: Difficulty;
  result: MatchResult | null;
  opponent_username: string | null;
  starting_rating: number;
  ending_rating: number | null;
  completion_time_ms: number | null;
  opponent_completion_time_ms: number | null;
  mistakes: number | null;
  completed_at: string | null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : null;
}

function parseHistoryRow(value: unknown): HistoryApiRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const gameType = enumValue(row.game_type, [GameType.SUDOKU, GameType.NONOGRAM]);
  const difficulty = enumValue(row.difficulty, [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]);
  const result = row.result === null
    ? null
    : enumValue(row.result, [MatchResult.WIN, MatchResult.LOSS, MatchResult.DRAW, MatchResult.ABANDONED]);
  if (
    typeof row.match_id !== "string"
    || !gameType
    || !difficulty
    || (row.result !== null && !result)
    || typeof row.starting_rating !== "number"
    || (typeof row.ending_rating !== "number" && row.ending_rating !== null)
    || (typeof row.opponent_username !== "string" && row.opponent_username !== null)
    || (typeof row.completed_at !== "string" && row.completed_at !== null)
  ) return null;
  return { ...row, game_type: gameType, difficulty, result } as unknown as HistoryApiRow;
}

/**
 * The view is scoped by auth.uid()/RLS. `viewerId` remains only as a source
 * compatibility parameter and is never sent to the database.
 */
export async function fetchMatchHistory(
  _viewerId: string,
  { take = 10, skip = 0, gameType }: MatchHistoryQuery = {},
): Promise<MatchHistoryRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .schema("api")
    .from("my_match_history")
    .select("match_id,game_type,difficulty,result,opponent_username,starting_rating,ending_rating,completion_time_ms,opponent_completion_time_ms,mistakes,completed_at")
    .order("completed_at", { ascending: false })
    .range(skip, Math.max(skip, skip + Math.max(1, take) - 1));
  if (gameType) query = query.eq("game_type", gameType);
  const { data, error } = await query;
  if (error) throw new Error("Private match history is unavailable");

  return (data ?? []).map(parseHistoryRow).filter((row): row is HistoryApiRow => row !== null).map((row) => ({
    id: row.match_id,
    matchId: row.match_id,
    gameType: row.game_type,
    difficulty: row.difficulty,
    result: row.result,
    opponentUsername: row.opponent_username ?? "Deleted player",
    ratingDelta: row.ending_rating === null ? null : Math.round(row.ending_rating - row.starting_rating),
    ratingAfter: row.ending_rating === null ? null : Math.round(row.ending_rating),
    completionTimeMs: row.completion_time_ms,
    opponentCompletionTimeMs: row.opponent_completion_time_ms,
    mistakes: row.mistakes,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  }));
}

export async function countMatches(_viewerId: string, gameType?: GameType): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .schema("api")
    .from("my_match_history")
    .select("match_id", { count: "exact", head: true });
  if (gameType) query = query.eq("game_type", gameType);
  const { count, error } = await query;
  if (error) throw new Error("Private match count is unavailable");
  return count ?? 0;
}

export const COMPLETION_TIME_SAMPLE = 200;

export async function fetchCompletionTimes(
  _viewerId: string,
  gameType: GameType,
): Promise<(number | null)[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("api")
    .from("my_match_history")
    .select("completion_time_ms")
    .eq("game_type", gameType)
    .order("completed_at", { ascending: false })
    .limit(COMPLETION_TIME_SAMPLE);
  if (error) throw new Error("Private completion times are unavailable");
  return (data ?? []).map((row: { completion_time_ms?: unknown }) =>
    typeof row.completion_time_ms === "number" ? row.completion_time_ms : null,
  );
}

export interface MatchDetailSide {
  userId: "viewer" | "opponent";
  username: string;
  result: MatchResult | null;
  startingRating: number;
  endingRating: number | null;
  completionTimeMs: number | null;
  mistakes: number | null;
  disconnected: boolean;
}

export interface MatchDetail {
  id: string;
  gameType: GameType;
  difficulty: Difficulty;
  puzzleId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  winnerUserId: "viewer" | "opponent" | null;
  you: MatchDetailSide;
  opponent: MatchDetailSide | null;
}

interface DetailApiRow {
  match_id: string;
  game_type: GameType;
  difficulty: Difficulty;
  puzzle_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_winner: boolean;
  is_viewer: boolean;
  username: string;
  result: MatchResult | null;
  starting_rating: number;
  ending_rating: number | null;
  completion_time_ms: number | null;
  mistakes: number | null;
  disconnect_status: string | null;
}

function parseDetailRow(value: unknown): DetailApiRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const gameType = enumValue(row.game_type, [GameType.SUDOKU, GameType.NONOGRAM]);
  const difficulty = enumValue(row.difficulty, [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]);
  const result = row.result === null
    ? null
    : enumValue(row.result, [MatchResult.WIN, MatchResult.LOSS, MatchResult.DRAW, MatchResult.ABANDONED]);
  if (
    typeof row.match_id !== "string" || !gameType || !difficulty
    || typeof row.username !== "string" || (typeof row.is_winner !== "boolean" && row.is_winner !== null)
    || typeof row.is_viewer !== "boolean" || typeof row.starting_rating !== "number"
    || (row.result !== null && !result)
  ) return null;
  // SQL equality against a draw's null winner produces null, not false.
  return { ...row, game_type: gameType, difficulty, result, is_winner: row.is_winner === true } as unknown as DetailApiRow;
}

/** RLS guarantees the caller participates; `viewerId` is never trusted. */
export async function fetchMatchDetail(
  matchId: string,
  _viewerId: string,
): Promise<MatchDetail | null> {
  void _viewerId;
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("api")
    .from("my_match_detail")
    .select("match_id,game_type,difficulty,puzzle_id,started_at,completed_at,is_winner,is_viewer,username,result,starting_rating,ending_rating,completion_time_ms,mistakes,disconnect_status")
    .eq("match_id", matchId);
  if (error) throw new Error("Private match detail is unavailable");
  const rows = (data ?? []).map(parseDetailRow).filter((row): row is DetailApiRow => row !== null);
  const viewer = rows.find((row) => row.is_viewer);
  if (!viewer) return null;
  const opponent = rows.find((row) => !row.is_viewer);

  const toSide = (row: DetailApiRow, side: "viewer" | "opponent"): MatchDetailSide => ({
    userId: side,
    username: row.username,
    result: row.result,
    startingRating: row.starting_rating,
    endingRating: row.ending_rating,
    completionTimeMs: row.completion_time_ms,
    mistakes: row.mistakes,
    disconnected: row.disconnect_status !== null && row.disconnect_status !== "CONNECTED",
  });
  const winner = rows.find((row) => row.is_winner);
  return {
    id: viewer.match_id,
    gameType: viewer.game_type,
    difficulty: viewer.difficulty,
    puzzleId: viewer.puzzle_id,
    startedAt: viewer.started_at ? new Date(viewer.started_at) : null,
    completedAt: viewer.completed_at ? new Date(viewer.completed_at) : null,
    winnerUserId: winner ? (winner.is_viewer ? "viewer" : "opponent") : null,
    you: toSide(viewer, "viewer"),
    opponent: opponent ? toSide(opponent, "opponent") : null,
  };
}
