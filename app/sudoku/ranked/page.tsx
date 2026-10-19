import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { AdSlot } from "@/components/ads/AdSlot";
import { SudokuRankedMatch } from "@/games/sudoku/components/SudokuRankedMatch";

export default async function SudokuRankedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 gap-12 px-6 min-[1440px]:grid-cols-[minmax(0,48rem)_160px] min-[1440px]:justify-center">
      <div className="min-w-0">
        <SudokuRankedMatch />
      </div>
      <AdSlot
        placement="ranked-desktop-rail"
        format="rail"
        className="my-8 self-start"
      />
    </main>
  );
}
