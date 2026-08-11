import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { SudokuPractice } from "@/games/sudoku/components/SudokuPractice";

export default async function SudokuPracticePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <SudokuPractice />
    </main>
  );
}
