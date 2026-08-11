# Changelog

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
