# Realtime

Standalone Socket.IO server (`npm run realtime`), separate process from
Next.js. The browser obtains a 90-second, one-use Ed25519 admission ticket
from the BFF; Supabase access/refresh tokens never enter browser JavaScript.

- `server.ts` — entry point: auth middleware, connection/reconnect
  handling, queue/progress/submit event handlers, readiness/liveness and
  graceful shutdown.
- `auth.ts` — validates `auth.ticket`, issuer/audience/type/version and maps
  its Supabase `sub` to an active server-side competitor. Upstash rejects JTI
  replay and revoked account/session markers; sensitive events recheck
  revocation with a five-second per-socket cache.
- `events.ts` — shared client/server event types (imported by the browser
  client too).
- `matchLifecycle.ts` — atomically persists a decided outcome and both rating
  changes, guarded by a compare-and-set on match status.
- `queueLoop.ts` — event-driven/adaptive matchmaking. A queue mutation runs
  immediately; unmatched active queues retry quickly and lone waiting players
  use a 15-second backoff instead of permanent one-second polling.
- `state.ts` — process-local state (active sockets, disconnect grace
  timers). The persisted `disconnectDeadlineAt` is authoritative after a
  restart.
- `client.ts` — browser-side Socket.IO client factory.

See `docs/SPEC.md` §10 and §12.

## Required Railway environment

- `DATABASE_URL`
- `REALTIME_JWS_ISSUER`, `REALTIME_JWS_AUDIENCE`
- `REALTIME_JWS_PUBLIC_KEYS` (JSON `kid -> SPKI PEM`) or the rotation fallback
  pair `REALTIME_JWS_KEY_ID` + `REALTIME_JWS_PUBLIC_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `REALTIME_REDIS_KEY_SECRET` (the same HMAC key used by the BFF for revocation)
- `PRACTICE_API_SECRET` (a separate 32+ character BFF-to-Railway bearer secret)
- `REALTIME_ALLOWED_ORIGINS` (comma-separated exact origins)

Optional tuning: `REALTIME_PORT`, `RECONNECT_GRACE_MS`,
`MATCHMAKING_ACTIVE_RETRY_MS`, `MATCHMAKING_WAITING_RETRY_MS` and
`MATCHMAKING_ERROR_RETRY_MS`. Health probes are `/health/live` and
`/health/ready`.
