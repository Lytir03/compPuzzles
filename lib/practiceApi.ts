import "server-only";

import { createHmac } from "node:crypto";
import { assertSameOrigin, getClientIp } from "@/auth/requestSecurity";
import { getVerifiedAuthContext } from "@/auth/session";
import type { RankedModeId } from "@/games/modes";

interface StartResponse {
  assignmentId: string;
  payload: string;
  expiresAt: string;
}

interface SubmitResponse {
  complete: boolean;
  correct: boolean;
}

function serviceUrl(): string {
  const value = process.env.REALTIME_INTERNAL_URL?.trim()
    ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");
  if (!value) throw new Error("REALTIME_INTERNAL_URL is required");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("REALTIME_INTERNAL_URL must use HTTPS in production");
  }
  return url.origin;
}

function apiSecret(): string {
  const value = process.env.PRACTICE_API_SECRET?.trim();
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRACTICE_API_SECRET (at least 32 characters) is required");
  }
  return "comppuzzles-local-practice-secret-only";
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  await assertSameOrigin();
  const [context, ip] = await Promise.all([getVerifiedAuthContext(), getClientIp()]);
  const secret = apiSecret();
  const headers: Record<string, string> = {
    authorization: `Bearer ${secret}`,
    "content-type": "application/json",
    "x-practice-client": createHmac("sha256", secret).update(ip).digest("hex"),
  };
  if (context) {
    headers["x-auth-user-id"] = context.user.id;
    if (context.sessionId) headers["x-auth-session-id"] = context.sessionId;
  }

  const response = await fetch(`${serviceUrl()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error(response.status === 429 ? "Too many practice requests. Try again shortly." : "Practice is temporarily unavailable.");
  }
  return payload as T;
}

export async function requestPracticeAssignment(modeId: RankedModeId): Promise<StartResponse> {
  const result = await request<StartResponse>("/api/practice/start", { modeId });
  if (
    typeof result.assignmentId !== "string"
    || typeof result.payload !== "string"
    || typeof result.expiresAt !== "string"
  ) throw new Error("Practice returned an invalid assignment.");
  return result;
}

export async function submitPracticeAssignment(
  assignmentId: string,
  payload: string,
): Promise<SubmitResponse> {
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId) || payload.length === 0 || payload.length > 16_384) {
    throw new Error("Invalid practice submission.");
  }
  const result = await request<SubmitResponse>("/api/practice/submit", { assignmentId, payload });
  if (typeof result.complete !== "boolean" || typeof result.correct !== "boolean") {
    throw new Error("Practice returned an invalid result.");
  }
  return result;
}
