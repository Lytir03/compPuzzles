import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ createSupabaseServerClient: vi.fn() }));
const { isDevBypassEnabled } = await import("./devBypass");

afterEach(() => vi.unstubAllEnvs());

describe("development login scope", () => {
  it.each(["http://localhost:55321", "http://127.0.0.1:55321", "http://[::1]:55321"])("allows explicitly enabled local development at %s", (url) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    vi.stubEnv("SUPABASE_URL", url);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "local-public-key");
    expect(isDevBypassEnabled()).toBe(true);
  });

  it.each(["production", "test"])("refuses the shortcut in %s", (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    expect(isDevBypassEnabled()).toBe(false);
  });

  it("refuses hosted Supabase even when the development flag is set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
    expect(isDevBypassEnabled()).toBe(false);
  });
});
