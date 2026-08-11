# Crossword

- `engine.ts` — grid representation, standard crossword numbering (`deriveSlots`), JSON wire-format encode/decode.
- `importFormat.ts` — validates and derives a persistable puzzle from the hand-authored JSON format (SPEC §16): checks the black-square `grid` against `width`/`height`, cross-checks every `clues.across`/`clues.down` entry against the numbering the grid layout actually produces, and builds the solution grid while catching any crossing-letter mismatch. Keeps puzzle ingestion separate from match logic (SPEC §16) so a bigger catalog can be imported later through the same path.
- `validator.ts` — `validateCompletion` compares directly against the stored solution grid, unlike Sudoku (self-verifying via uniqueness) or Nonogram (self-verifying via clue-derivation): a crossword's black-square layout alone doesn't determine which words are correct, so the server genuinely needs the answer key (SPEC §10). This is also why `GameDefinition.validateCompletion` takes a `puzzleId` and is async — see `matchmaking/gameDefinition.ts`.
- `progress.ts` — pure `calculateProgress` (cells filled, not necessarily correct), shared by the server and the ranked match UI.
- `gameDefinition.ts` — this game's implementation of `matchmaking/gameDefinition.ts`'s shared interface.
- `actions.ts` — Server Actions for single-player practice mode.
- `components/` — `CrosswordBoard` (numbered grid + across/down clue lists, click/keyboard navigation), `CrosswordPractice`, `CrosswordRankedMatch`.
- `content/*.json` — curated demo puzzles in the SPEC §16 import format, loaded by `database/seed.ts` via `parseCrosswordImport`. No generator — SPEC explicitly rules out a "sophisticated crossword generator" for the MVP, so difficulty here comes from vocabulary/clue directness, not procedural generation.

Matchmaking, rating, and match lifecycle are all reused unchanged from Sudoku/Nonogram's infrastructure — this game only adds the engine/UI/content, per SPEC's Phase 6 instructions.
