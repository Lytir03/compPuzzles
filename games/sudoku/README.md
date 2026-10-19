# Sudoku

- `engine.ts` — shared grid representation and helpers for 6×6 (2×3 boxes) and classic 9×9 Sudoku.
- `validator.ts` — conflict detection, an MRV backtracking solver, `validateCompletion`.
- `generator.ts` — random solved-grid generation + uniqueness-preserving puzzle carving. The public modes are a lower-clue 6×6 Challenge, an easy 9×9, and a hard 9×9.
- `progress.ts` — pure `calculateProgress`, shared by the server (`gameDefinition.ts`) and the ranked match UI (no server/DB dependency, safe in a client bundle).
- `gameDefinition.ts` — Sudoku's implementation of `matchmaking/gameDefinition.ts`'s shared interface.
- `actions.ts` — Server Actions for single-player practice mode (Phase 2).
- `components/` — `SudokuBoard` (interactive grid, shared by practice and ranked), `SudokuPractice` (practice difficulty picker + orchestration), `SudokuRankedMatch` (queue → countdown → live match → result).

Rating math isn't here — Glicko-2 (`rating/glicko2.ts`) and win/loss rules
(`matchmaking/determineWinner.ts`) are identical across every game, so they
live shared, not duplicated per game. See `docs/SPEC.md` §14.
