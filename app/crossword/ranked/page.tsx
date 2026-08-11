import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { CrosswordRankedMatch } from "@/games/crossword/components/CrosswordRankedMatch";

export default async function CrosswordRankedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <CrosswordRankedMatch />
    </main>
  );
}
