import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRecoveryProof, verifyRecoveryProof } from "./recoveryProof";

beforeAll(() => {
  vi.stubEnv("AUTH_FLOW_HMAC_SECRET", "test-only-recovery-secret-with-32-bytes");
});

afterAll(() => vi.unstubAllEnvs());

describe("password recovery proof", () => {
  it("is bound to the Supabase session id", () => {
    const proof = createRecoveryProof("session-a");
    expect(verifyRecoveryProof(proof, "session-a")).toBe(true);
    expect(verifyRecoveryProof(proof, "session-b")).toBe(false);
  });

  it("rejects a modified signature", () => {
    const proof = createRecoveryProof("session-a");
    const forged = `${proof.slice(0, -1)}${proof.endsWith("a") ? "b" : "a"}`;
    expect(verifyRecoveryProof(forged, "session-a")).toBe(false);
  });
});
