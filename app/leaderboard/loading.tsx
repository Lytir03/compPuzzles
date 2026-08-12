import { LoadingAnnouncement, SkeletonBlock, SkeletonRows } from "@/components/Skeleton";

export default function LeaderboardLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <LoadingAnnouncement label="Loading the leaderboard" />
      <SkeletonBlock className="h-44 rounded-3xl sm:h-40" />
      <div className="mt-8 flex gap-2">
        <SkeletonBlock className="h-11 w-28 rounded-xl" />
        <SkeletonBlock className="h-11 w-32 rounded-xl" />
        <SkeletonBlock className="h-11 w-32 rounded-xl" />
      </div>
      <SkeletonRows count={8} />
    </main>
  );
}
