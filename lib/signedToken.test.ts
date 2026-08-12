import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  __setSecretForTesting,
  createSignedToken,
  generateSecret,
  verifySignedToken,
} from "./signedToken";

const HOUR = 60 * 60 * 1000;

beforeAll(() => __setSecretForTesting("test-secret-value-at-least-16"));
afterAll(() => __setSecretForTesting(null));

describe("signed tokens", () => {
  it("round-trips a subject", () => {
    const token = createSignedToken("user_123", "session", HOUR);
    expect(verifySignedToken(token, "session")).toBe("user_123");
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSignedToken("user_123", "session", HOUR);
    __setSecretForTesting("a-completely-different-secret");
    expect(verifySignedToken(token, "session")).toBeNull();
    __setSecretForTesting("test-secret-value-at-least-16");
  });

  it("rejects a tampered subject", () => {
    const token = createSignedToken("user_123", "session", HOUR);
    const [, purpose, expiresAt, signature] = token.split(".");
    const forged = Buffer.from("user_victim", "utf8").toString("base64url");
    expect(verifySignedToken(`${forged}.${purpose}.${expiresAt}.${signature}`, "session")).toBeNull();
  });

  it("rejects an extended expiry", () => {
    const token = createSignedToken("user_123", "session", HOUR);
    const [subject, purpose, expiresAt, signature] = token.split(".");
    const extended = String(Number(expiresAt) + HOUR);
    expect(verifySignedToken(`${subject}.${purpose}.${extended}.${signature}`, "session")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSignedToken("user_123", "session", HOUR);
    expect(verifySignedToken(token, "session", Date.now() + 2 * HOUR)).toBeNull();
  });

  it("rejects a token minted for another purpose", () => {
    const token = createSignedToken("user_123", "realtime", HOUR);
    expect(verifySignedToken(token, "session")).toBeNull();
  });

  it("rejects a raw userId (the pre-signing format)", () => {
    expect(verifySignedToken("user_123", "session")).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    for (const bad of ["", ".", "a.b.c", "a.b.c.d.e", "....", "🙂"]) {
      expect(verifySignedToken(bad, "session")).toBeNull();
    }
  });

  it("survives a subject containing the field separator", () => {
    const token = createSignedToken("weird.id.with.dots", "session", HOUR);
    expect(verifySignedToken(token, "session")).toBe("weird.id.with.dots");
  });

  it("generates distinct secrets", () => {
    expect(generateSecret()).not.toBe(generateSecret());
    expect(generateSecret()).toHaveLength(64);
  });
});
