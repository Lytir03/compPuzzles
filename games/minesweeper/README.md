# Minesweeper generation

- `engine.ts` contains the board representation, neighbor helpers, and the safe client payload.
- `solver.ts` is a deterministic no-guess verifier. It uses normal number deductions, constraint-subset deductions, zero expansion, and the global mine count. It never branches or selects a merely probable cell.
- `generator.ts` creates a seeded board with a protected central opening and rejects candidates until the verifier solves the entire board.
- `components/` contains the playable practice flow and responsive board, including click/tap clearing, right-click/long-press flags, and number chording.

The returned `seed` recreates the same accepted board, while `openingCell` must be revealed for both competitors. The mine map stays server-side and must not be included in the client puzzle payload.
