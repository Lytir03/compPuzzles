import { describe, expect, it } from "vitest";
import { isAllowedRealtimeOrigin } from "./origin";

const allowed = ["https://puzzles.example", "http://localhost:3000"];

describe("isAllowedRealtimeOrigin", () => {
  it("accepts only an exact configured HTTP(S) origin", () => {
    expect(isAllowedRealtimeOrigin("https://puzzles.example", allowed)).toBe(true);
    expect(isAllowedRealtimeOrigin("http://localhost:3000", allowed)).toBe(true);
  });

  it("rejects missing, lookalike, path-bearing and malformed origins", () => {
    expect(isAllowedRealtimeOrigin(undefined, allowed)).toBe(false);
    expect(isAllowedRealtimeOrigin("https://evilpuzzles.example", allowed)).toBe(false);
    expect(isAllowedRealtimeOrigin("https://puzzles.example.evil.test", allowed)).toBe(false);
    expect(isAllowedRealtimeOrigin("https://puzzles.example/", allowed)).toBe(false);
    expect(isAllowedRealtimeOrigin("not-an-origin", ["not-an-origin"])).toBe(false);
  });
});
