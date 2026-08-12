import { LoadingAnnouncement, SkeletonBlock, SkeletonRows } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <LoadingAnnouncement label="Loading your game lobby" />
      <SkeletonBlock className="h-44 rounded-3xl sm:h-40" />

      <SkeletonBlock className="mt-10 h-8 w-52 rounded-xl" />
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <SkeletonBlock className="h-[340px] rounded-3xl" />
        <SkeletonBlock className="h-[340px] rounded-3xl" />
        <SkeletonBlock className="h-[340px] rounded-3xl" />
      </div>

      <div className="mt-12">
        <SkeletonBlock className="h-8 w-48 rounded-xl" />
        <SkeletonRows count={5} />
      </div>

      <div className="mt-12 pb-8">
        <SkeletonBlock className="h-8 w-56 rounded-xl" />
        <SkeletonRows count={5} />
      </div>
    </main>
  );
}
