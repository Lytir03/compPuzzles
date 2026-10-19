import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Difficulty,
  DisconnectStatus,
  GameType,
  MatchResult,
} from "@/database/generated/client/enums";

const MATCH_ID = "9f4d81de-4f94-4e7f-9e6d-4cdb21a9b150";
const ALICE = "competitor_alice";
const BOB = "competitor_bob";

const api = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as { message: string } | null,
  schema: "" as string,
  view: "" as string,
  columns: "" as string,
  filterColumn: "" as string,
  filterValue: "" as string,
  calls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    schema: (schema: string) => {
      api.schema = schema;
      return {
        from: (view: string) => {
          api.view = view;
          return {
            select: (columns: string) => {
              api.columns = columns;
              return {
                eq: async (column: string, value: string) => {
                  api.calls += 1;
                  api.filterColumn = column;
                  api.filterValue = value;
                  return { data: api.rows, error: api.error };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

const { fetchMatchDetail } = await import("./matchHistory");

function side({
  username,
  isViewer,
  isWinner,
  result,
  endingRating,
  completionTimeMs,
  mistakes,
  disconnectStatus,
}: {
  username: string;
  isViewer: boolean;
  isWinner: boolean;
  result: MatchResult;
  endingRating: number;
  completionTimeMs: number | null;
  mistakes: number;
  disconnectStatus: DisconnectStatus;
}) {
  return {
    match_id: MATCH_ID,
    game_type: GameType.SUDOKU,
    difficulty: Difficulty.MEDIUM,
    puzzle_id: "puzzle_1",
    started_at: "2026-08-11T10:00:00.000Z",
    completed_at: "2026-08-11T10:02:00.000Z",
    is_winner: isWinner,
    is_viewer: isViewer,
    username,
    result,
    starting_rating: 1500,
    ending_rating: endingRating,
    completion_time_ms: completionTimeMs,
    mistakes,
    disconnect_status: disconnectStatus,
  };
}

function completedRows(viewer: "alice" | "bob" = "alice") {
  return [
    side({
      username: "alice",
      isViewer: viewer === "alice",
      isWinner: true,
      result: MatchResult.WIN,
      endingRating: 1516,
      completionTimeMs: 61_000,
      mistakes: 0,
      disconnectStatus: DisconnectStatus.CONNECTED,
    }),
    side({
      username: "bob",
      isViewer: viewer === "bob",
      isWinner: false,
      result: MatchResult.LOSS,
      endingRating: 1484,
      completionTimeMs: null,
      mistakes: 2,
      disconnectStatus: DisconnectStatus.DISCONNECTED,
    }),
  ];
}

beforeEach(() => {
  api.rows = completedRows();
  api.error = null;
  api.schema = "";
  api.view = "";
  api.columns = "";
  api.filterColumn = "";
  api.filterValue = "";
  api.calls = 0;
});

describe("fetchMatchDetail", () => {
  it("maps the RLS-scoped rows from the viewer's perspective", async () => {
    const detail = await fetchMatchDetail(MATCH_ID, ALICE);

    expect(detail).not.toBeNull();
    expect(detail!.you.username).toBe("alice");
    expect(detail!.opponent!.username).toBe("bob");
    expect(detail!.you.startingRating).toBe(1500);
    expect(detail!.you.endingRating).toBe(1516);
    expect(detail!.winnerUserId).toBe("viewer");
    expect(detail!.startedAt).toEqual(new Date("2026-08-11T10:00:00.000Z"));
  });

  it("uses is_viewer from the trusted view rather than the compatibility argument", async () => {
    api.rows = completedRows("bob");
    const detail = await fetchMatchDetail(MATCH_ID, BOB);

    expect(detail!.you.username).toBe("bob");
    expect(detail!.you.mistakes).toBe(2);
    expect(detail!.you.disconnected).toBe(true);
    expect(detail!.opponent!.username).toBe("alice");
    expect(detail!.winnerUserId).toBe("opponent");
  });

  it("returns null when RLS exposes no participant rows", async () => {
    api.rows = [];
    await expect(fetchMatchDetail(MATCH_ID, "stranger")).resolves.toBeNull();
  });

  it("shows draws when SQL returns null for equality against a null winner", async () => {
    api.rows = completedRows().map((row) => ({ ...row, is_winner: null, result: MatchResult.DRAW }));
    const detail = await fetchMatchDetail(MATCH_ID, ALICE);
    expect(detail?.winnerUserId).toBeNull();
    expect(detail?.you.result).toBe(MatchResult.DRAW);
    expect(detail?.opponent?.result).toBe(MatchResult.DRAW);
  });

  it("returns null for an invalid or absent match without querying the API", async () => {
    await expect(fetchMatchDetail("not-a-uuid", ALICE)).resolves.toBeNull();
    expect(api.calls).toBe(0);

    api.rows = [];
    await expect(fetchMatchDetail(MATCH_ID, ALICE)).resolves.toBeNull();
    expect(api.calls).toBe(1);
  });

  it("fails closed when the private Data API view errors", async () => {
    api.error = { message: "permission denied" };
    await expect(fetchMatchDetail(MATCH_ID, ALICE)).rejects.toThrow(
      "Private match detail is unavailable",
    );
  });

  it("queries only the safe api projection and never requests a solution", async () => {
    await fetchMatchDetail(MATCH_ID, ALICE);

    expect(api.schema).toBe("api");
    expect(api.view).toBe("my_match_detail");
    expect(api.filterColumn).toBe("match_id");
    expect(api.filterValue).toBe(MATCH_ID);
    expect(api.columns).not.toMatch(/solution|secret|answer/i);
  });
});
