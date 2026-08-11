# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session. Keep it
tight — it governs *how* you work in this repo. The full product spec lives in
`docs/SPEC.md`; read it before starting Phase 1 and re-check the relevant
section before starting any new phase.

## What this project is

A web-only competitive puzzle platform ("Chess.com for puzzle games").
Ranked 1v1 matches across Sudoku, Mini Crosswords, and Nonograms, with
per-game ratings, matchmaking, leaderboards, and match history. Full detail:
`docs/SPEC.md`.

## Non-negotiables (violating these is a bug, not a style choice)

- **Server is authoritative.** Never trust a client "I won" message. All win
  conditions, board validity, and rating changes are computed and verified
  server-side.
- **No solutions leaked early.** Puzzle solutions must never reach the client
  before match completion.
- **Rating changes happen inside a DB transaction.** A match must never award
  rating twice, and rating writes must be atomic with match-result writes.
- **Independent ratings per game.** No shared/universal rating.
- **No monetization, no native apps, no social features** in MVP scope — see
  `docs/SPEC.md` §2 for the explicit exclusion list. If a task seems to need
  one of these, stop and flag it rather than building it.
- **Sudoku ships completely (Phase 1–4) before Nonograms or Crosswords
  start.** Do not parallelize game verticals.

## Tech stack (do not deviate without flagging it first)

- Next.js + React + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Auth: **Clerk, deferred.** SPEC §17 locks in Clerk, but as of 2026-08-11
  the user asked to skip it while the build stays local-only — no point
  standing up a hosted auth provider for a single-machine demo. Current
  stand-in: a local username-only session (no password) in `auth/session.ts`
  (httpOnly cookie), `auth/currentUser.ts`, `auth/login.ts` (upserts a `User`
  by username, no identity check), and `auth/logout.ts`. `User.clerkId` and
  `User.email` are nullable in the schema for exactly this reason. Swap Clerk
  back in through this same seam (those four files) once there's an actual
  reason to deploy somewhere other than localhost — don't let this stand-in
  quietly become permanent.
- Realtime: **Socket.IO** — automatic reconnection (needed for the disconnect
  grace-period requirement) and room support (one room per match) without
  hand-rolling either. It's a separate process from Next.js (port 4000 vs.
  3000) — those are different origins, and the session cookie is
  SameSite=Lax, which browsers don't reliably send on cross-origin
  XHR/WebSocket handshakes. So socket auth does **not** use the cookie:
  the client fetches its own userId same-origin via
  `auth/realtimeToken.ts` and passes it as the socket handshake's
  `auth.token` (see `realtime/auth.ts`). Don't "simplify" this back to
  cookie-based auth — it'll silently fail in a real browser.
- Deployment: **local only for now.** Everything (Next.js dev server, Socket.IO
  process, Postgres) runs on localhost — no hosting, no split-deployment
  concerns. This is a "get something working and demoable" build, not a
  production deploy. Modular monolith either way — no microservices.
  Revisit hosting (Vercel + a separate always-on Node service for Socket.IO,
  since Vercel serverless functions can't hold a persistent WS connection)
  only when there's an actual reason to put this in front of other people.

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

## Commands

Fill these in once the project is scaffolded (Phase 1) so future sessions
don't have to rediscover them:

```
# dev server:                     npm run dev
# realtime (Socket.IO) process:   npm run realtime      (separate process, port 4000 by default — run alongside `npm run dev`)
# run tests:                      npm run test          (npm run test:watch for watch mode)
# lint:                           npm run lint
# typecheck:                      npm run typecheck
# db migrate:                     npm run db:migrate    (requires `docker compose up -d` first)
# db seed:                        npm run db:seed  (SUDOKU_PUZZLES_PER_DIFFICULTY=100 to match SPEC §14's example; default 20/difficulty, idempotent top-up)
# db generate (Prisma client):    npm run db:generate
# db studio (inspect data):       npm run db:studio
```

Postgres runs locally via Docker (`docker-compose.yml` at repo root, service
`postgres`, port 5432) — no managed/cloud DB needed at this stage. Bring it up
with `docker compose up -d` before running migrations or `npm run dev`.

No Clerk setup needed right now — see the Tech stack section above for why
auth is a local username-only stand-in instead.

## When in doubt

Re-read `docs/SPEC.md` §30 ("Important product decisions") before inventing a
new assumption — most ambiguous calls are already answered there.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
