import { getRankTier } from "@/rating/tiers";

const TIER_COLORS: Record<string, string> = {
  Bronze: "bg-amber-800/20 text-amber-700 dark:text-amber-400",
  Silver: "bg-slate-400/20 text-slate-600 dark:text-slate-300",
  Gold: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-400",
  Platinum: "bg-cyan-400/20 text-cyan-700 dark:text-cyan-400",
  Diamond: "bg-blue-400/20 text-blue-700 dark:text-blue-400",
  Master: "bg-purple-400/20 text-purple-700 dark:text-purple-400",
  Grandmaster: "bg-rose-400/20 text-rose-700 dark:text-rose-400",
};

export function RankBadge({ rating }: { rating: number }) {
  const tier = getRankTier(rating);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[tier.name]}`}
    >
      {tier.name}
    </span>
  );
}
