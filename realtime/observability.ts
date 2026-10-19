import * as Sentry from "@sentry/node";
import { sanitizeSentryEvent } from "@/lib/sentrySanitizer";

let initialized = false;

export function initializeRealtimeObservability(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN?.trim();
  Sentry.init({
    dsn,
    enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeSentryEvent,
  });
}

function write(level: "info" | "error", event: string, fields: Record<string, unknown> = {}): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "realtime",
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

/** Capture the origin stack without forwarding an exception message or payload. */
export function reportRealtimeError(event: string, error?: unknown): void {
  write("error", event);
  if (!process.env.SENTRY_DSN?.trim()) return;

  const safeError = new Error(`Realtime failure: ${event}`);
  if (error instanceof Error && error.stack) {
    safeError.stack = `${safeError.name}: ${safeError.message}\n${error.stack.split("\n").slice(1).join("\n")}`;
  }
  Sentry.withScope((scope) => {
    scope.setTag("realtime.event", event);
    Sentry.captureException(safeError);
  });
}

export function logRealtimeEvent(event: string, fields: Record<string, unknown> = {}): void {
  write("info", event, fields);
}

export async function flushRealtimeObservability(timeoutMs = 2_000): Promise<void> {
  if (process.env.SENTRY_DSN?.trim()) await Sentry.flush(timeoutMs);
}
