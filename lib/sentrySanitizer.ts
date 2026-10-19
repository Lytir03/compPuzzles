import type { Event } from "@sentry/nextjs";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

function redact(value: string | undefined): string | undefined {
  return value
    ?.replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(UUID_PATTERN, "[redacted-id]");
}

function stripQuery(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return redact(value.split("?", 1)[0]);
  }
}

/**
 * Keep Sentry useful for stack traces while removing application identities,
 * request bodies, cookies, headers, breadcrumbs and arbitrary extra context.
 */
export function sanitizeSentryEvent<T extends Event>(event: T): T {
  event.user = undefined;
  event.breadcrumbs = undefined;
  event.extra = undefined;

  if (event.request) {
    event.request.cookies = undefined;
    event.request.data = undefined;
    event.request.env = undefined;
    event.request.headers = undefined;
    event.request.query_string = undefined;
    event.request.url = stripQuery(event.request.url);
  }

  event.message = redact(event.message);
  for (const value of event.exception?.values ?? []) {
    value.value = redact(value.value);
  }

  return event;
}
