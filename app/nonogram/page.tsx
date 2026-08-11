import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { NonogramPractice } from "@/games/nonogram/components/NonogramPractice";

export default async function NonogramPracticePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <NonogramPractice />
    </main>
  );
}
