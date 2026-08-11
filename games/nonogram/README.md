# Nonogram

- `engine.ts` — grid representation, clue derivation (`deriveClues`/`deriveLineClue`), JSON wire-format encode/decode.
- `validator.ts` — `validateCompletion` via derived-clue matching against the puzzle's clues, not a stored-solution comparison. A nonogram's row/column clues fully define what counts as a solution, so this is the complete correctness check (see the doc comment for why that also correctly accepts any grid satisfying an ambiguous puzzle, not just one canonical answer).
- `generator.ts` — random grid + derived clues. Difficulty = board size (5×5/10×10/15×15, SPEC's own examples) rather than a solvability/uniqueness guarantee — SPEC explicitly lowers the quality bar here vs. Sudoku.
- `progress.ts` — pure `calculateProgress` (cells decided, not necessarily correct), shared by the server and the ranked match UI.
- `gameDefinition.ts` — this game's implementation of `matchmaking/gameDefinition.ts`'s shared interface.
- `actions.ts` — Server Actions for single-player practice mode.
- `components/` — `NonogramBoard` (clue-labeled grid, click-to-cycle + drag-to-paint input), `NonogramPractice`, `NonogramRankedMatch`.

Matchmaking, rating, and match lifecycle are all reused unchanged from Sudoku's infrastructure — this game only adds the engine/UI, per SPEC's Phase 5 instructions.
