# Matchmaking

Phase 3: queue entry handling (`MatchmakingQueueEntry`), rating-distance
pairing, race-condition-safe match creation. Interacts with each game via the
shared `GameDefinition` interface (`createMatch`, `validateMove`,
`validateCompletion`, `calculateProgress`, `determineWinner`) — no
game-specific rules belong here. See `docs/SPEC.md` §9.
