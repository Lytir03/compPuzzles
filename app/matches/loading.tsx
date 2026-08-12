import { LoadingAnnouncement, SkeletonBlock, SkeletonRows } from "@/components/Skeleton";

export default function MatchesLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <LoadingAnnouncement label="Loading your match history" />
      <SkeletonBlock className="h-9 w-56 rounded-xl" />
      <SkeletonBlock className="mt-3 h-4 w-40 rounded-md" />
      <div className="mt-6 flex gap-2">
        <SkeletonBlock className="h-11 w-28 rounded-xl" />
        <SkeletonBlock className="h-11 w-28 rounded-xl" />
        <SkeletonBlock className="h-11 w-32 rounded-xl" />
      </div>
      <SkeletonRows count={10} />
    </main>
  );
}
