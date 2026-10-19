const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_-]{3,20}$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_CHARACTERS = 12;

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "auth",
  "comppuzzles",
  "deleted",
  "help",
  "moderator",
  "null",
  "official",
  "root",
  "security",
  "staff",
  "support",
  "system",
  "undefined",
]);

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function readFormString(formData: FormData, name: string, maxLength: number): string {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.length > maxLength) return "";
  return raw;
}

export function validateEmail(raw: string): ValidationResult<string> {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "invalid-email" };
  }
  return { ok: true, value: email };
}

export function validatePassword(raw: string): ValidationResult<string> {
  const bytes = new TextEncoder().encode(raw).byteLength;
  if (raw.length < MIN_PASSWORD_CHARACTERS || bytes > MAX_PASSWORD_BYTES) {
    return { ok: false, error: "invalid-password" };
  }
  return { ok: true, value: raw };
}

export function validateUsername(raw: string): ValidationResult<{
  username: string;
  canonical: string;
}> {
  const canonical = raw.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(canonical) || RESERVED_USERNAMES.has(canonical)) {
    return { ok: false, error: "invalid-username" };
  }
  return { ok: true, value: { username: canonical, canonical } };
}

export function isChecked(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, "http://internal.invalid");
    return url.origin === "http://internal.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export const AUTH_INPUT_LIMITS = {
  email: MAX_EMAIL_LENGTH,
  password: MAX_PASSWORD_BYTES,
  username: 20,
} as const;
