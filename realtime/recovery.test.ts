import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();

vi.mock("@/database/client", () => ({
  prisma: { matchParticipant: { updateMany } },
}));

const { claimParticipantReconnect } = await import("./recovery");

beforeEach(() => updateMany.mockReset());

describe("claimParticipantReconnect", () => {
  it("uses one CAS over status, unexpired deadline and live match", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const now = new Date("2026-08-17T12:00:00.000Z");

    await expect(claimParticipantReconnect("participant", now)).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "participant",
        disconnectStatus: "DISCONNECTED",
        disconnectDeadlineAt: { gt: now },
        match: { status: "IN_PROGRESS" },
      },
      data: { disconnectStatus: "RECONNECTED", disconnectDeadlineAt: null },
    });
  });

  it("loses safely if abandonment or another state change wins", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(claimParticipantReconnect("participant")).resolves.toBe(false);
  });
});
