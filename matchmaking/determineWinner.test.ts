import { describe, expect, it } from "vitest";
import { determineWinner, type ParticipantOutcome } from "./determineWinner";

function participant(overrides: Partial<ParticipantOutcome> = {}): ParticipantOutcome {
  return { userId: "u1", completionTimeMs: null, mistakes: 0, disconnected: false, ...overrides };
}

describe("determineWinner", () => {
  it("returns null while both are still in progress", () => {
    const a = participant({ userId: "a" });
    const b = participant({ userId: "b" });
    expect(determineWinner([a, b])).toBeNull();
  });

  it("declares the first to complete correctly the winner", () => {
    const a = participant({ userId: "a", completionTimeMs: 42_000 });
    const b = participant({ userId: "b" });
    expect(determineWinner([a, b])).toEqual({
      type: "winner",
      winnerUserId: "a",
      reason: "completion",
    });
  });

  it("breaks a simultaneous-completion tie by time", () => {
    const a = participant({ userId: "a", completionTimeMs: 50_000 });
    const b = participant({ userId: "b", completionTimeMs: 40_000 });
    expect(determineWinner([a, b])).toEqual({
      type: "winner",
      winnerUserId: "b",
      reason: "completion",
    });
  });

  it("breaks an exact-time tie by mistake count", () => {
    const a = participant({ userId: "a", completionTimeMs: 50_000, mistakes: 3 });
    const b = participant({ userId: "b", completionTimeMs: 50_000, mistakes: 1 });
    expect(determineWinner([a, b])).toEqual({
      type: "winner",
      winnerUserId: "b",
      reason: "completion",
    });
  });

  it("declares a draw when time and mistakes both tie exactly", () => {
    const a = participant({ userId: "a", completionTimeMs: 50_000, mistakes: 2 });
    const b = participant({ userId: "b", completionTimeMs: 50_000, mistakes: 2 });
    expect(determineWinner([a, b])).toEqual({ type: "draw" });
  });

  it("awards the win to the opponent on abandonment, even mid-solve", () => {
    const a = participant({ userId: "a", disconnected: true });
    const b = participant({ userId: "b" });
    expect(determineWinner([a, b])).toEqual({
      type: "winner",
      winnerUserId: "b",
      reason: "abandonment",
    });
  });

  it("abandonment outranks an in-progress opponent even if the opponent later would have completed", () => {
    const a = participant({ userId: "a", disconnected: true });
    const b = participant({ userId: "b", completionTimeMs: 99_000 });
    expect(determineWinner([a, b])).toEqual({
      type: "winner",
      winnerUserId: "b",
      reason: "abandonment",
    });
  });

  it("declares a draw when both abandon", () => {
    const a = participant({ userId: "a", disconnected: true });
    const b = participant({ userId: "b", disconnected: true });
    expect(determineWinner([a, b])).toEqual({ type: "draw" });
  });
});
