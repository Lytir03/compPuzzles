import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { SudokuRankedMatch } from "@/games/sudoku/components/SudokuRankedMatch";

export default async function SudokuRankedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <SudokuRankedMatch />
    </main>
  );
}
