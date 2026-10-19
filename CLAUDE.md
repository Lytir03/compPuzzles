# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session. Keep it
tight — it governs *how* you work in this repo. The full product spec lives in
`docs/SPEC.md`; read it before starting Phase 1 and re-check the relevant
section before starting any new phase.

## What this project is

A web-only competitive puzzle platform ("Chess.com for puzzle games").
Ranked 1v1 matches across Sudoku and Nonograms, plus local no-guess
Minesweeper practice, per-game ratings, matchmaking, leaderboards, and match
history. Crossword code is archived and unreachable. Full detail:
`docs/SPEC.md`.

## Non-negotiables (violating these is a bug, not a style choice)

- **Server is authoritative.** Never trust a client "I won" message. All win
  conditions, board validity, and rating changes are computed and verified
  server-side — chess.com is the reference model the user explicitly wants
  followed here (2026-08-11): every outcome that matters is decided by the
  server, never asserted by a client. Concretely: `validateCompletion()` and
  `determineWinner()` (matchmaking/determineWinner.ts) run only server-side;
  a client submission is re-checked against the puzzle's given cells, never
  trusted. The one deliberate exception is the opponent-progress percentage
  shown mid-match — purely cosmetic (SPEC has Sudoku hide opponents' actual
  moves, unlike chess.com's shared board), can't affect who wins or any
  rating, so it isn't worth re-deriving server-side from a full grid on
  every keystroke. Apply this same bar to Nonogram/Crossword when they're
  built: server decides the outcome, client input for anything else gets
  scrutinized before being trusted.
- **No solutions leaked early.** Puzzle solutions must never reach the client
  before match completion.
- **Rating changes happen inside a DB transaction.** A match must never award
  rating twice, and rating writes must be atomic with match-result writes.
- **Independent ratings per game.** No shared/universal rating.
- **No active ads, prizes, native apps, or social features in the beta.** Ad
  slots are inert vendor-neutral boundaries until a separate legal/CMP gate.

## Tech stack (do not deviate without flagging it first)

- Next.js + React + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Auth: **Supabase email/password with mandatory email verification.** Next is
  a server-only BFF: no browser Supabase client and no access/refresh token in
  JavaScript. Request-scoped `@supabase/ssr` clients use hardened HttpOnly
  cookies. Supabase owns password hashes, reset tokens, and sessions; Prisma
  must never model or read them. Account identity and competitive history are
  separated as `AccountProfile -> Competitor`.
- Realtime: **Socket.IO** — automatic reconnection (needed for the disconnect
  grace-period requirement) and room support (one room per match) without
  hand-rolling either. It's a separate process from Next.js (port 4000 vs.
  3000) — those are different origins, and the session cookie is
  SameSite=Lax, which browsers don't reliably send on cross-origin
  XHR/WebSocket handshakes. So socket auth does **not** use the cookie:
  the client requests a one-use 90-second Ed25519 admission ticket from
  `auth/realtimeToken.ts` and passes it only as `auth.ticket`. Never expose a
  Supabase bearer token, put tickets in URLs/storage, or reuse a JTI.
- Deployment: **public beta without an SLA.** Netlify runs web/BFF, Supabase EU
  runs Auth/Postgres/Data API, one Railway EU replica runs Socket.IO, and
  Upstash stores distributed rate/replay/revocation state. See
  `docs/DEPLOYMENT.md`; never give Netlify a database or service-role secret.

## Code organization

Game logic stays isolated per game and talks to matchmaking/rating through a
shared interface, not bespoke coupling:

```
/games/{sudoku,crossword,nonogram}/  engine, validator, generator, components
/matchmaking/
/rating/
/realtime/
/auth/
/database/
```

Common interface each game implements: `createMatch()`, `validateMove()`,
`validateCompletion()`, `calculateProgress()`, `determineWinner()`. Don't put
game-specific rules in generic matchmaking code.

## Process for every phase

Before writing code for a new phase:
1. State the plan for that phase in a few sentences (what's being built, key
   decisions, files touched).
2. Flag anything that requires a real product/technical decision instead of
   guessing.

After finishing a phase:
1. Run tests, lint, and typecheck.
2. Confirm the app still starts.
3. Write a short changelog note (what changed, why, anything deferred).
4. Stop and summarize rather than silently continuing into the next phase.

Build order is fixed — see `docs/SPEC.md` §29 for the full phase breakdown:
Foundation → Sudoku single-player → Multiplayer infra → Ranked Sudoku →
Nonograms → Crosswords → Polish.

## Testing expectations

Unit-test game logic independently of UI: puzzle validators (Sudoku,
Nonogram, Crossword), rating calculations, match-completion logic, duplicate
completion requests, rating transaction safety, matchmaking rules. Integration
tests for the core loop: queue → match found → play → winner validated →
rating updated.

## Security baseline

Never trust client-side win calculation. Validate all API inputs. Rate-limit
sensitive endpoints (matchmaking, match completion). Prevent clients from
writing ratings directly. Protect websocket events the same as HTTP endpoints.

How that's implemented (Phase 7) — extend these rather than reinventing:

- **Socket payloads** are parsed by `realtime/validation.ts` before touching
  Prisma or any game decoder, and every handler is wrapped by `guard()` in
  `realtime/server.ts`. Both matter: the handlers are floating promises, and
  a game's `decodeGrid` is a bare `JSON.parse`, so one malformed message used
  to crash the whole realtime process for every player in every live match.
  A new client→server event needs a parser and a `guard()` wrapper — no
  exceptions.
- **Server actions** are public HTTP endpoints. Validate exact shapes and
  lengths, enforce same-origin mutations, Turnstile where required, and use
  the distributed auth limiter in `auth/rateLimit.ts`.
- **Authoritative mutations** use Upstash-backed rate limits in production and
  fail closed when the security store is unavailable. Never clear a bucket on
  socket disconnect.
- **Match finalization** claims the match with a compare-and-set on status
  *inside* the transaction (`realtime/matchLifecycle.ts`); the pre-transaction
  status read alone can't stop two concurrent finalizations. The
  `@@unique([competitorId, matchId])` on `RatingChange` is the DB-level backstop.

## Commands

Fill these in once the project is scaffolded (Phase 1) so future sessions
don't have to rediscover them:

```
# local Supabase:                 npm run db:start
# one-time local env:             npm run setup:local
# dev server:                     npm run dev:web
# realtime (Socket.IO) process:   npm run dev:realtime
# run tests:                      npm run test          (npm run test:watch for watch mode)
# lint:                           npm run lint
# typecheck:                      npm run typecheck
# db reset/migrate:               npm run db:reset / npm run db:migrate
# db seed (puzzles only):         npm run db:seed
# db generate (Prisma client):    npm run db:generate
# RLS tests:                      npm run test:rls
# schema authority check:         npm run schema:check
```

Supabase SQL migrations are the sole schema authority. Prisma is a typed client
only: `generate` and `validate` are allowed; never run Prisma migrate/db push.
Local Supabase uses ports 55321–55324 and Mailpit for verification/reset mail.

## When in doubt

Re-read `docs/SPEC.md` §30 ("Important product decisions") before inventing a
new assumption — most ambiguous calls are already answered there.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
