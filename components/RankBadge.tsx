import { getRankTier } from "@/rating/tiers";

const TIER_COLORS: Record<string, string> = {
  Bronze: "border-amber-700/20 bg-amber-700/12 text-amber-700 dark:text-amber-300",
  Silver: "border-slate-500/20 bg-slate-400/15 text-slate-600 dark:text-slate-200",
  Gold: "border-yellow-600/20 bg-yellow-400/18 text-yellow-700 dark:text-yellow-300",
  Platinum: "border-cyan-600/20 bg-cyan-400/16 text-cyan-700 dark:text-cyan-300",
  Diamond: "border-blue-600/20 bg-blue-400/15 text-blue-700 dark:text-blue-300",
  Master: "border-purple-600/20 bg-purple-400/15 text-purple-700 dark:text-purple-300",
  Grandmaster: "border-rose-600/20 bg-rose-400/15 text-rose-700 dark:text-rose-300",
};

export function RankBadge({ rating }: { rating: number }) {
  const tier = getRankTier(rating);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${TIER_COLORS[tier.name]}`}
    >
      <span className="text-[8px]" aria-hidden="true">◆</span>
      {tier.name}
    </span>
  );
}
