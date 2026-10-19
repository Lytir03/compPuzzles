import { beforeEach, describe, expect, it } from "vitest";
import {
  admissionGuardSize,
  admissionInFlight,
  beginRealtimeAdmission,
  clearAdmissionGuard,
} from "./admissionGuard";

beforeEach(clearAdmissionGuard);

describe("allowRealtimeAdmission", () => {
  it("blocks replay of the same raw ticket before expensive verification", () => {
    const release = beginRealtimeAdmission("sensitive-ticket", 1_000);
    expect(release).toBeTypeOf("function");
    release?.();
    expect(beginRealtimeAdmission("sensitive-ticket", 1_001)).toBeNull();
  });

  it("bounds concurrent expensive verification without trusting proxy addresses", () => {
    const releases = Array.from(
      { length: 64 },
      (_, index) => beginRealtimeAdmission(`ticket-${index}`, 1_000),
    );
    expect(releases.every((release) => typeof release === "function")).toBe(true);
    expect(admissionInFlight()).toBe(64);
    expect(beginRealtimeAdmission("one-too-many", 1_000)).toBeNull();
    for (const release of releases) release?.();
    expect(admissionInFlight()).toBe(0);
  });

  it("keeps a hard memory ceiling under high-cardinality input", () => {
    for (let index = 0; index < 4_000; index++) {
      const release = beginRealtimeAdmission(`ticket-${index}`, 1_000);
      release?.();
    }
    expect(admissionGuardSize()).toBeLessThanOrEqual(2_048);
  });

  it("allows a ticket fingerprint again only after its bounded window", () => {
    beginRealtimeAdmission("ticket", 1_000)?.();
    expect(beginRealtimeAdmission("ticket", 120_999)).toBeNull();
    const release = beginRealtimeAdmission("ticket", 121_000);
    expect(release).toBeTypeOf("function");
    release?.();
  });
});
