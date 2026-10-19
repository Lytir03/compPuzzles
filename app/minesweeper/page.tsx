import { MinesweeperPractice } from "@/games/minesweeper/components/MinesweeperPractice";

export default async function MinesweeperPracticePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
      <MinesweeperPractice />
    </main>
  );
}
