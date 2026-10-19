import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ createSupabaseServerClient: vi.fn() }));
const { isEmailVerified } = await import("./session");

describe("mandatory email verification", () => {
  it("accepts a confirmed email identity", () => {
    expect(isEmailVerified({ email: "test@example.test", email_confirmed_at: "2026-10-18" } as User)).toBe(true);
  });

  it("does not substitute phone or generic account confirmation for email verification", () => {
    expect(isEmailVerified({ email: "test@example.test", confirmed_at: "2026-10-18", phone_confirmed_at: "2026-10-18" } as User)).toBe(false);
  });

  it("requires the confirmed email to be present", () => {
    expect(isEmailVerified({ email_confirmed_at: "2026-10-18" } as User)).toBe(false);
  });
});
