import { beforeEach, describe, expect, it, vi } from "vitest";

let completion: number | null;
let lastWhere: Record<string, unknown> | null;

vi.mock("@/database/client", () => ({
  prisma: {
    matchParticipant: {
      updateMany: vi.fn(async ({ where, data }: {
        where: Record<string, unknown>;
        data: { completionTimeMs: number };
      }) => {
        lastWhere = where;
        if (completion !== null) return { count: 0 };
        completion = data.completionTimeMs;
        return { count: 1 };
      }),
    },
  },
}));

const { elapsedSinceStart, recordFirstCompletion } = await import("./completion");

beforeEach(() => {
  completion = null;
  lastWhere = null;
  vi.clearAllMocks();
});

describe("recordFirstCompletion", () => {
  it("rejects missing or future starts without writing", async () => {
    expect(elapsedSinceStart(null, 1_000)).toBeNull();
    expect(await recordFirstCompletion("p1", "competitor", new Date(2_000), 1_000)).toBe("pre-start");
    expect(completion).toBeNull();
  });

  it("records server elapsed time once", async () => {
    expect(await recordFirstCompletion("p1", "competitor", new Date(1_000), 2_234)).toBe("recorded");
    expect(completion).toBe(1_234);
    expect(lastWhere).toMatchObject({
      id: "p1",
      competitorId: "competitor",
      competitor: { status: "ACTIVE" },
      match: { status: "IN_PROGRESS" },
    });
    expect(await recordFirstCompletion("p1", "competitor", new Date(1_000), 9_999)).toBe("duplicate");
    expect(completion).toBe(1_234);
  });

  it("lets exactly one concurrent completion win the compare-and-set", async () => {
    const results = await Promise.all([
      recordFirstCompletion("p1", "competitor", new Date(1_000), 2_000),
      recordFirstCompletion("p1", "competitor", new Date(1_000), 2_001),
    ]);
    expect(results.sort()).toEqual(["duplicate", "recorded"]);
  });
});
