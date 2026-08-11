# Matchmaking

- `gameDefinition.ts` — the shared per-game interface (`createMatch`,
  `getPuzzlePayload`, `calculateProgress`, `validateCompletion`) plus the
  registry (`registerGameDefinition`/`getGameDefinition`). `determineWinner`
  is deliberately *not* per-game — see the doc comment in this file for why.
- `determineWinner.ts` — the one shared win-condition rule for every game.
- `matchmaker.ts` — pure, DB-free pairing algorithm (rating-distance
  widening by wait time, per SPEC §5). Actually reading/writing the queue
  and creating matches happens in `realtime/queueLoop.ts`, which calls this.
- `registerGames.ts` — wires up each game's GameDefinition; called once at
  realtime server startup.

See `docs/SPEC.md` §9. The realtime server (`realtime/`) is the only caller
of any of this — no game-specific rules belong here.
