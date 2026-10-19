import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { resolveClientIp } = await import("./requestSecurity");

function requestHeaders(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("resolveClientIp", () => {
  it("trusts only Netlify's connection header in production", () => {
    const headers = requestHeaders({
      "x-nf-client-connection-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.99",
      "cf-connecting-ip": "192.0.2.44",
    });
    expect(resolveClientIp(headers, true)).toBe("203.0.113.10");
  });

  it("fails closed instead of using spoofable production fallbacks", () => {
    const headers = requestHeaders({
      "x-forwarded-for": "203.0.113.10",
      "x-real-ip": "203.0.113.11",
    });
    expect(() => resolveClientIp(headers, true)).toThrow("trusted client IP");
  });

  it("rejects malformed Netlify values in production", () => {
    const headers = requestHeaders({ "x-nf-client-connection-ip": "203.0.113.10, 198.51.100.2" });
    expect(() => resolveClientIp(headers, true)).toThrow("trusted client IP");
  });

  it("allows explicit forwarding fallbacks only during local development", () => {
    expect(resolveClientIp(requestHeaders({ "x-forwarded-for": "::1, 203.0.113.10" }), false)).toBe("::1");
    expect(resolveClientIp(requestHeaders({}), false)).toBe("127.0.0.1");
  });
});
