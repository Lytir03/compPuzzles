import { describe, expect, it } from "vitest";
import { escalateShutdownExitCode, exitCodeForShutdown } from "./shutdownPolicy";

describe("exitCodeForShutdown", () => {
  it("exits cleanly only for orchestrator/operator termination signals", () => {
    expect(exitCodeForShutdown("SIGTERM")).toBe(0);
    expect(exitCodeForShutdown("SIGINT")).toBe(0);
  });

  it("requests Railway restart for fatal and startup failures", () => {
    expect(exitCodeForShutdown("unhandled-rejection")).toBe(1);
    expect(exitCodeForShutdown("uncaught-exception")).toBe(1);
    expect(exitCodeForShutdown("startup-failure")).toBe(1);
  });

  it("cannot downgrade an in-flight fatal shutdown to a clean exit", () => {
    expect(escalateShutdownExitCode(1, 0)).toBe(1);
    expect(escalateShutdownExitCode(0, 1)).toBe(1);
    expect(escalateShutdownExitCode(0, 0)).toBe(0);
  });
});
