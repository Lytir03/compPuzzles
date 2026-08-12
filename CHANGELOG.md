# Changelog

## 2026-08-12 — Phase 7 completion: mobile nav, missing routes, result motion

Finishes the Phase 7 items the security-focused pass left open. Nothing here
revisits work already done on 2026-08-11 (4).

### Fixed

- **The leaderboard and match history were unreachable on a phone.** The nav
  hid "Leaderboard" below 460px and "History" below `lg` rather than collapsing
  them, so on a 390px screen two of the four destinations simply did not exist.
  There's now a real mobile menu (`components/MobileNav.tsx`) holding every
  destination plus sign-out; the desktop bar is unchanged above `md`.
- **The Sudoku number pad could sit below the fold mid-match.** With the timer,
  board, and opponent-progress bar stacked above it, entering a digit cost a
  scroll on every move. It's sticky to the bottom on phones now. Crossword and
  Nonogram got mobile passes in earlier phases; Sudoku's pad hadn't.
- Leaderboard "Games played" was hidden below 420px — a column SPEC §7 requires
  — and equal ratings were ordered nondeterministically, so a player's rank
  could flicker between reloads. Ties now break on games played, then user id.
- Arrow-key navigation on the Sudoku board called `.focus()` without
  `preventScroll`, which scroll-jumps the board on mobile Safari.

### Added

- **Per-match detail pages** (`/matches/[id]`) — SPEC §20 wants every ranked
  result auditable, and until now the puzzle a match was decided on, and both
  players' ratings *before* the change, were stored but never surfaced. Shows
  both sides' rating before/after, both solve times, rejected submissions,
  disconnects, timestamps, and the puzzle id. Readable only by that match's own
  participants, and it deliberately never queries the puzzle's solution.
- **`error.tsx`, `not-found.tsx`, and `global-error.tsx`.** There were no error
  boundaries at all: a dropped Postgres connection rendered Next's raw error
  page, and `notFound()` on an unknown username fell through to the default 404
  — both with no nav and no way back into the app.
- **`loading.tsx` for the six practice/ranked game routes**, which all await
  `getCurrentUser()` in a server component. Previously the browser held the
  previous route for that whole query before the board's own "Joining the
  arena…" state could even start.
- **Leaderboard pagination.** `PAGE_SIZE` was a hard `take` with no page
  param, so rank 51+ was unreachable except via the pinned viewer row.
- **A leaderboard preview on the dashboard**, which SPEC §21 requires by name.
  The lobby had no leaderboard query and no link to one in its body, which —
  combined with the nav gap above — made the ladder unreachable on a phone.
  It previews the game the player has actually played most.

### Improved

- **Result screen.** Only the rating count-up was animated; the board was
  replaced by the verdict in a single frame. Added an entrance transition, a
  badge pop, a win confetti burst, and a tier change that lands *after* the
  rating count-up so a promotion reads as its own beat. Demotions no longer
  borrow the promotion's wording. The screen also no longer dead-ends at
  requeue — it links to the match detail, the opponent's profile, and history.
  All of it is reduced-motion aware; confetti is not rendered at all in that
  mode rather than flashing for one clamped frame.
- Match history rows show the opponent's solve time and your rejected-submission
  count. Both were already being fetched and thrown away, and a 4:58 loss to a
  4:56 solve reads very differently from a 4:58 loss to a 2:10. Rows link to the
  new detail page (only where the viewer is a participant).
- Profile cards show per-game "Games played" — SPEC §8 lists it, and it's the
  win-rate denominator that was being computed from an invisible number.
- `fetchCompletionTimes` was unbounded and ran three times per profile render;
  it now samples the 200 most recent, which is also a more honest "average
  solve" than one weighted by a player's first week forever.
- Landing copy claimed "Race real players in Sudoku" and "Sudoku live now ·
  More games coming" two phases after Crosswords and Nonograms shipped ranked
  play. Also adds SPEC §22's missing fourth value prop.
- Leaderboard queries moved into `database/leaderboard.ts` so the standings
  page and the dashboard preview can't drift into different orderings.

### Verified

- All 173 tests pass (9 new: `fetchMatchDetail` access control — non-participant
  and in-progress matches return null, and the query never selects the puzzle —
  plus confetti seed determinism, which hydration correctness depends on).
- Lint, TypeScript checks, and the production build all pass.
- Exercised against the running app and a real DB: dashboard, leaderboard
  (including `?page=2`), match history, profile, all six game routes, the new
  match-detail page, and both 404 paths all render. Confirmed the detail page's
  HTML contains no puzzle solution.

### Deferred

- `notFound()` returns a **soft 404** (HTTP 200 with `noindex`), not a real 404
  status. This is documented Next 16 behaviour — the static shell streams
  before the existence check runs, and the status can't change afterwards.
  Fixing it properly means moving the check into `proxy`, which isn't worth it
  for a local-only app with no SEO surface. Unmatched routes still 404 normally.
- `/matches` remains viewer-only, so another player's profile shows their 8
  most recent matches but no full-history link. Browsing a stranger's complete
  history is a product decision, not an oversight.
- No rating-history graph on profiles. `RatingChange` rows have everything
  needed; SPEC §8 doesn't ask for it.

## 2026-08-11 (4) — Phase 7: polish + security pass

### Security

- **Session cookie and Socket.IO handshake token are now HMAC-signed and
  expiring** (`lib/signedToken.ts`, `AUTH_SECRET`). Both were previously the
  bare userId — and userIds aren't secret. Because the realtime server drops
  an existing socket when the same user reconnects, anyone holding a victim's
  id could connect as them, kick them out of a live ranked match, and let the
  disconnect grace period hand them a loss and a rating hit. Purposes are
  domain-separated so neither token can be replayed as the other.
- **Every client→server socket payload is validated** (`realtime/validation.ts`)
  and every handler is wrapped so a throw can't escape (`guard()` in
  `realtime/server.ts`, plus process-level rejection handlers). Previously a
  single malformed message — `payload: "{"` reaching a game's bare
  `JSON.parse`, or `difficulty: "LOL"` reaching Prisma's enum check — threw
  inside a floating promise and took the whole realtime process down for every
  player in every live match.
- **Rate limiting added everywhere it was missing** (`lib/rateLimit.ts`):
  socket events, the three practice server actions, and the passwordless login
  (which could otherwise mint unlimited users). Practice submission was also an
  unmetered correctness oracle usable against a puzzle from a live ranked match.
- **Double-finalization race closed.** `finalizeMatch` now claims the match with
  a compare-and-set on status *inside* the transaction; the pre-transaction
  status read alone couldn't stop two concurrent finalizations (both players
  submitting at once, or a submit racing the abandonment timer). Previously the
  loser hit the `RatingChange` unique constraint, and that rejection propagated
  into a floating promise and crashed the server.
- **Resubmission can no longer rewrite a recorded completion time** — the value
  that decides the match and the tie-break.
- Server actions validate difficulty/puzzle id/duration (`lib/actionGuards.ts`);
  `match:progress` now requires an in-progress match and rejects `NaN`, which
  previously survived the clamp and was broadcast to the opponent.

### Fixed

- **Mistakes were never recorded**, so `determineWinner`'s mistake tie-break
  always compared 0 to 0 and fell through to a draw. Incorrect ranked
  submissions now increment the counter, which also gives SPEC §11's anti-cheat
  foundations an actual signal.
- **Completion times were inflated by the 3-second countdown.** `Match.startedAt`
  is now the instant boards go live, so stored times match the timer players saw.
- Crossword letter entry went only through `onKeyDown`, which Android soft
  keyboards frequently don't populate — it now also reads `onChange`.
- The nonogram board's on-screen hint promised long-press-to-mark-× but nothing
  implemented it; it now works.
- A socket disconnect that had already been replaced by a newer connection no
  longer tears down the newer connection's queue entry.

### Added

- **Player profile pages** (`/profile/[username]`) — join date, per-game rating,
  tier, peak, rating deviation, W/L/D, win rate, average and best solve time,
  and recent form. `peakRating` and `draws` were stored since Phase 1 but had
  never been rendered anywhere.
- **Full match history** (`/matches`) with per-game filtering and pagination.
  History rows now show difficulty, solve time, and when the match happened.
- **Reconnect UX.** The server has always handled disconnects, but no client
  ever subscribed to the events — you'd sit on a frozen board with no feedback.
  There's now a reconnect banner, an opponent-disconnected notice with the
  grace period, and rejected-submission feedback (previously emitted and
  silently discarded).
- Loading skeletons for every DB-backed route, and pending states on the
  sign-in/sign-out forms and the queue buttons (which previously double-emitted
  on a fast double-tap).
- Result screens now show both players' solve times, tier promotions, and a
  one-tap "play again at the same difficulty".
- `npm run db:seed` creates `demo_one` / `demo_two` accounts, so two-player
  testing no longer starts with manual signup.

### Improved

- The three ranked-match components shared ~110 byte-identical lines each;
  that logic now lives once in `components/ranked/useRankedMatch.ts` +
  `RankedMatchShell.tsx`. Nonogram and Crossword had never received Sudoku's
  visual pass — all three are now identical in quality, and future match-UI
  work is a one-place edit instead of a three-way one.
- Mobile: crossword grids used fixed 44px cells, so a 15-wide puzzle overflowed
  every phone; nonogram cells were 24px (well under the 44px tap-target
  guideline) and the grid couldn't be panned by touch at all. Both are now
  viewport-relative with sticky clue gutters.
- Leaderboard: usernames link to profiles, and your own standing is pinned
  below the table when you're outside the top 50.

### Verified

- All 164 tests pass (54 new: token signing/tampering/expiry, rate limiting,
  socket payload validation, `finalizeMatch` transaction/idempotency/race
  behaviour, and profile statistics).
- Lint, TypeScript checks, and the production build complete successfully.

### Deferred

- No `suspicionScore` field or move-timestamp logging yet. SPEC §11 names both
  but also says not to overengineer anti-cheat for MVP; `mistakes`,
  `completionTimeMs`, and `disconnectStatus` are now the real signals a later
  scorer would read.
- Rate limiting is in-memory and process-local, so it would need Redis before
  running more than one instance.
- No integration test drives a real Postgres end-to-end; `finalizeMatch`'s
  transaction behaviour is covered against a fake that models row locking and
  rollback, not the real database.

## 2026-08-11 (3)

### Added

- Ranked and practice Crosswords: hand-authored 5×5 mini puzzles (2 per difficulty) imported through a validated JSON format (SPEC §16 — no procedural crossword generator), numbered grid + across/down clue list UI with click/keyboard navigation, full matchmaking/rating reuse from Sudoku/Nonogram.
- `GameDefinition.validateCompletion` now takes `puzzleId` and is async, so a game can fetch server-only data (like Crossword's answer key) to validate — Sudoku/Nonogram's implementations are unaffected in behavior, just thin async wrappers now.

### Verified

- All 110 tests pass (26 new for Crossword: grid numbering, import-format validation, completion checking).
- Lint, TypeScript checks, and the production build complete successfully.
- Live two-socket test against the real server/DB: matched players get the identical puzzle, opponent progress relays correctly, a correct solve wins with a real rating change, an incorrect solve is rejected server-side (match stays in progress) — all persisted correctly.
- All 6 demo puzzles import cleanly and idempotently via `npm run db:seed`.

## 2026-08-11 (2)

### Added

- Ranked and practice Nonograms: procedurally generated puzzles (5×5/10×10/15×15), click-to-cycle and drag-to-paint board input, full matchmaking/rating reuse from Sudoku.

### Verified

- All 84 tests pass (35 new for Nonogram).
- Lint, TypeScript checks, and the production build complete successfully.
- Live two-socket test against the real server/DB: matched players get the identical puzzle, opponent progress relays correctly, a correct solve wins with a real rating change, all persisted correctly.

## 2026-08-11

### Added

- Ranked Sudoku ratings with animated post-match rating changes.
- A global leaderboard with per-game rankings, win rates, and player tiers.
- A polished game lobby with rating cards and recent match results.

### Improved

- Refreshed the site with a warmer, more vibrant competitive-game visual style.
- Redesigned the landing page, navigation, sign-in flow, dashboard, and leaderboard.
- Upgraded Sudoku practice and ranked-match screens, including matchmaking, countdown, opponent progress, results, and board interaction states.
- Improved responsive layouts, keyboard focus styles, and reduced-motion accessibility.

### Verified

- All 51 tests pass.
- Lint, TypeScript checks, and the production build complete successfully.
