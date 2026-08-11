# Realtime

Standalone Socket.IO server (`npm run realtime`), separate process from
Next.js — see CLAUDE.md's Tech stack section for why socket auth uses an
explicit token instead of the session cookie.

- `server.ts` — entry point: auth middleware, connection/reconnect
  handling, queue/progress/submit event handlers, starts the matchmaking
  tick.
- `auth.ts` — validates the handshake's `auth.token` against a real User.
- `events.ts` — shared client/server event types (imported by the browser
  client too).
- `matchLifecycle.ts` — persists a decided match outcome and notifies both
  clients. Rating is untouched here — Phase 4 adds real rating math.
- `queueLoop.ts` — the periodic tick that reads the DB-backed queue, calls
  `matchmaking/matchmaker.ts` to pair players, and creates matches.
- `state.ts` — process-local state (active sockets, disconnect grace
  timers). Fine for a single instance; the DB is the source of truth for
  everything that needs to survive a restart.
- `client.ts` — browser-side Socket.IO client factory.

See `docs/SPEC.md` §10 and §12.
