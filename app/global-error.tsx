"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort boundary for a throw in the root layout itself, which `error.tsx`
 * can't catch — it replaces the whole document, so it must render its own
 * `<html>`/`<body>` and can't rely on the app's stylesheet being applied.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "#fbf9f2",
          color: "#25291f",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: 0 }}>CompPuzzles is down</h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, opacity: 0.7 }}>
            The app failed to start. Nothing was lost — ratings and results live on the server.
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem", opacity: 0.6 }}>
              ref {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.85rem 1.75rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#8fcb5d",
              color: "#1f380f",
              fontSize: "1rem",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
