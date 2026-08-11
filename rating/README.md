# Rating

- `constants.ts` — initial rating/RD/volatility (1500/350/0.06), mirrors the `PlayerGameRating` column defaults.
- `tiers.ts` — Bronze..Grandmaster thresholds (SPEC §6), config-driven rather than hardcoded wherever a badge renders.
- `glicko2.ts` — the rating engine itself (SPEC §5 prefers Glicko-2 over Elo). Verified in `glicko2.test.ts` against Mark Glickman's own published worked example, not just internally-derived expectations — see the test file's comment for why that matters for rating-affecting code.

Shared across every game (no per-game rating logic) — called from `realtime/matchLifecycle.ts` when a match is finalized.
