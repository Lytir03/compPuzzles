import { afterEach, describe, expect, it, vi } from "vitest";
import { logRealtimeEvent, reportRealtimeError } from "./observability";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("realtime observability", () => {
  it("logs structured metadata without serializing an exception message", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    reportRealtimeError("match_submit_failed", new Error("secret-grid-123456789"));

    expect(errorSpy).toHaveBeenCalledOnce();
    const serialized = String(errorSpy.mock.calls[0][0]);
    expect(JSON.parse(serialized)).toMatchObject({
      service: "realtime",
      level: "error",
      event: "match_submit_failed",
    });
    expect(serialized).not.toContain("secret-grid");
  });

  it("writes JSON for lifecycle events", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logRealtimeEvent("ready", { allowedOrigins: 1 });
    expect(JSON.parse(String(logSpy.mock.calls[0][0]))).toMatchObject({
      event: "ready",
      allowedOrigins: 1,
    });
  });
});
