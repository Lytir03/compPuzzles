import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { NonogramRankedMatch } from "@/games/nonogram/components/NonogramRankedMatch";

export default async function NonogramRankedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <NonogramRankedMatch />
    </main>
  );
}
