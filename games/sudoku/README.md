# Sudoku

- `engine.ts` — grid representation and helpers (row/col/box/peer indices, string<->array).
- `validator.ts` — conflict detection, an MRV backtracking solver, `validateCompletion`.
- `generator.ts` — random solved-grid generation + uniqueness-preserving puzzle carving.
- `actions.ts` — Server Actions for single-player practice mode (Phase 2).
- `components/` — `SudokuBoard` (interactive grid), `SudokuPractice` (difficulty picker + orchestration).

`rating.ts` and ranked-match wiring arrive in Phase 4. See `docs/SPEC.md` §14.
