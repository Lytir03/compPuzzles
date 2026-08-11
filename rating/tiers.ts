// Rank tier thresholds, config-driven per SPEC §6 rather than hardcoded
// wherever a tier badge is rendered.
export const RANK_TIERS = [
  { name: "Bronze", min: 0, max: 999 },
  { name: "Silver", min: 1000, max: 1299 },
  { name: "Gold", min: 1300, max: 1499 },
  { name: "Platinum", min: 1500, max: 1699 },
  { name: "Diamond", min: 1700, max: 1899 },
  { name: "Master", min: 1900, max: 2099 },
  { name: "Grandmaster", min: 2100, max: Infinity },
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export function getRankTier(rating: number): RankTier {
  return (
    RANK_TIERS.find((tier) => rating >= tier.min && rating <= tier.max) ??
    RANK_TIERS[0]
  );
}
