import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./contentSecurityPolicy";

describe("content security policy", () => {
  it("permits HTTPS polling and WSS upgrades on the configured realtime host", () => {
    const policy = contentSecurityPolicy("request-nonce", {
      NODE_ENV: "production",
      NEXT_PUBLIC_REALTIME_URL: "https://realtime.example.test",
    });
    expect(policy).toContain("connect-src 'self' https://realtime.example.test wss://realtime.example.test");
    expect(policy).toContain("'nonce-request-nonce'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("permits local WebSocket upgrades in development", () => {
    const policy = contentSecurityPolicy("nonce", {
      NODE_ENV: "development",
      NEXT_PUBLIC_REALTIME_URL: "http://localhost:4000",
    });
    expect(policy).toContain("ws://localhost:4000");
    expect(policy).toContain("'unsafe-eval'");
  });

  it("omits malformed configuration without broadening the allowed hosts", () => {
    const policy = contentSecurityPolicy("nonce", { NODE_ENV: "production", NEXT_PUBLIC_REALTIME_URL: "invalid" });
    expect(policy).not.toContain("invalid");
    expect(policy).not.toContain("connect-src *");
  });
});
