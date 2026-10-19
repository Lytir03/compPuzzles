import { SudokuPractice } from "@/games/sudoku/components/SudokuPractice";

export default async function SudokuPracticePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <SudokuPractice />
    </main>
  );
}
