# Sudoku

- `engine.ts` — grid representation and helpers (row/col/box/peer indices, string<->array).
- `validator.ts` — conflict detection, an MRV backtracking solver, `validateCompletion`.
- `generator.ts` — random solved-grid generation + uniqueness-preserving puzzle carving.
- `progress.ts` — pure `calculateProgress`, shared by the server (`gameDefinition.ts`) and the ranked match UI (no server/DB dependency, safe in a client bundle).
- `gameDefinition.ts` — Sudoku's implementation of `matchmaking/gameDefinition.ts`'s shared interface.
- `actions.ts` — Server Actions for single-player practice mode (Phase 2).
- `components/` — `SudokuBoard` (interactive grid, shared by practice and ranked), `SudokuPractice` (practice difficulty picker + orchestration), `SudokuRankedMatch` (queue → countdown → live match → result).

`rating.ts` (real Glicko-2 math) arrives in Phase 4 — ranked matches already work end-to-end (Phase 3) but don't touch rating yet. See `docs/SPEC.md` §14.
