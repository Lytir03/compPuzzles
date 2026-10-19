# Nonogram

- `engine.ts` — grid representation, clue derivation (`deriveClues`/`deriveLineClue`), JSON wire-format encode/decode.
- `validator.ts` — `validateCompletion` via derived-clue matching against the puzzle's clues, not a stored-solution comparison. A nonogram's row/column clues fully define what counts as a solution, so this is the complete correctness check (see the doc comment for why that also correctly accepts any grid satisfying an ambiguous puzzle, not just one canonical answer).
- `solver.ts` — logic-only line-domain solver. It intersects every valid placement for each row/column and never branches or guesses.
- `generator.ts` — random candidate grids plus derived clues, rejecting candidates until the logic-only solver finishes. A fully deduction-solved puzzle is also uniquely solvable.
- `progress.ts` — pure `calculateProgress` (cells decided, not necessarily correct), shared by the server and the ranked match UI.
- `gameDefinition.ts` — this game's implementation of `matchmaking/gameDefinition.ts`'s shared interface.
- `actions.ts` — Server Actions for single-player practice mode.
- `components/` — `NonogramBoard` (clue-labeled grid, click-to-cycle + drag-to-paint input), `NonogramPractice`, `NonogramRankedMatch`.

Matchmaking, rating, and match lifecycle are all reused unchanged from Sudoku's infrastructure — this game only adds the engine/UI, per SPEC's Phase 5 instructions.

The launch modes are deliberately limited to 5×5 and 10×10 so matchmaking is not split across a premature third queue. The generator still enforces logic-only, unique solutions for both.
