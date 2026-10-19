import "server-only";

import { isProduction, requireServerEnv } from "./env";

interface TurnstileResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
}

export function readTurnstileToken(formData: FormData): string | null {
  const rawToken = formData.get("cf-turnstile-response");
  return typeof rawToken === "string" && rawToken.length >= 10 && rawToken.length <= 2_048
    ? rawToken
    : null;
}

export async function verifyTurnstile(
  formData: FormData,
  expectedAction: string,
  remoteIp: string,
): Promise<boolean> {
  if (!isProduction() && process.env.TURNSTILE_DEV_BYPASS === "true") return true;

  const secret = requireServerEnv("TURNSTILE_SECRET_KEY");
  const expectedHostname = requireServerEnv("TURNSTILE_EXPECTED_HOSTNAME").toLowerCase();
  const rawToken = readTurnstileToken(formData);
  if (!rawToken) return false;

  const body = new URLSearchParams({
    secret,
    response: rawToken,
    remoteip: remoteIp,
  });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as TurnstileResponse;
  return result.success === true
    && result.action === expectedAction
    && result.hostname?.toLowerCase() === expectedHostname;
}
