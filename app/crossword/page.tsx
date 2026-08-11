import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { CrosswordPractice } from "@/games/crossword/components/CrosswordPractice";

export default async function CrosswordPracticePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <CrosswordPractice />
    </main>
  );
}
