import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requireLogoutRevocation } = await import("./logoutRevocation");

describe("requireLogoutRevocation", () => {
  it("writes the session marker before logout may continue", async () => {
    const write = vi.fn(async () => undefined);
    await expect(requireLogoutRevocation({ sessionId: "session-123" }, write)).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledWith("sid", "session-123");
  });

  it("fails closed when Redis cannot persist the marker", async () => {
    const write = vi.fn(async () => {
      throw new Error("Redis unavailable");
    });
    await expect(requireLogoutRevocation({ sessionId: "session-123" }, write)).rejects.toThrow(
      "Redis unavailable",
    );
  });

  it("fails closed when an authenticated context has no session id", async () => {
    const write = vi.fn(async () => undefined);
    await expect(requireLogoutRevocation({ sessionId: null }, write)).rejects.toThrow(
      "could not identify",
    );
    expect(write).not.toHaveBeenCalled();
  });

  it("allows an already-unauthenticated request to clear stale local state", async () => {
    const write = vi.fn(async () => undefined);
    await expect(requireLogoutRevocation(null, write)).resolves.toBeUndefined();
    expect(write).not.toHaveBeenCalled();
  });
});
