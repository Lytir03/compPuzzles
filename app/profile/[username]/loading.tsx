import { LoadingAnnouncement, SkeletonBlock, SkeletonRows } from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <LoadingAnnouncement label="Loading player profile" />
      <SkeletonBlock className="h-44 rounded-3xl sm:h-36" />

      <SkeletonBlock className="mt-10 h-8 w-40 rounded-xl" />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SkeletonBlock className="h-64 rounded-3xl" />
        <SkeletonBlock className="h-64 rounded-3xl" />
        <SkeletonBlock className="h-64 rounded-3xl" />
      </div>

      <div className="mt-12 pb-8">
        <SkeletonBlock className="h-8 w-48 rounded-xl" />
        <SkeletonRows count={5} />
      </div>
    </main>
  );
}
