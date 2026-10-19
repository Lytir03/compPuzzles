import { describe, expect, it } from "vitest";
import {
  sanitizeInternalRedirect,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./validation";

describe("auth validation", () => {
  it("normalizes email without accepting malformed addresses", () => {
    expect(validateEmail(" Player@Example.COM ")).toEqual({ ok: true, value: "player@example.com" });
    expect(validateEmail("player@example").ok).toBe(false);
    expect(validateEmail("a".repeat(255) + "@example.com").ok).toBe(false);
  });

  it("enforces 12 characters and the bcrypt 72-byte boundary", () => {
    expect(validatePassword("elevenchars").ok).toBe(false);
    expect(validatePassword("twelve-chars").ok).toBe(true);
    expect(validatePassword("a".repeat(72)).ok).toBe(true);
    expect(validatePassword("a".repeat(73)).ok).toBe(false);
    expect(validatePassword("🔐".repeat(19)).ok).toBe(false);
  });

  it("canonicalizes usernames and rejects reserved or ambiguous forms", () => {
    expect(validateUsername("Puzzle_Master")).toEqual({
      ok: true,
      value: { username: "puzzle_master", canonical: "puzzle_master" },
    });
    expect(validateUsername("admin").ok).toBe(false);
    expect(validateUsername("two words").ok).toBe(false);
    expect(validateUsername("ab").ok).toBe(false);
  });

  it("allows only same-site relative redirect targets", () => {
    expect(sanitizeInternalRedirect("/dashboard?tab=rating", "/")).toBe("/dashboard?tab=rating");
    expect(sanitizeInternalRedirect("//evil.example/path", "/")).toBe("/");
    expect(sanitizeInternalRedirect("https://evil.example", "/")).toBe("/");
    expect(sanitizeInternalRedirect("/\\evil.example", "/")).toBe("/");
  });
});
