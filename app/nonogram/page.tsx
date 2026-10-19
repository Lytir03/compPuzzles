import { NonogramPractice } from "@/games/nonogram/components/NonogramPractice";

export default async function NonogramPracticePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6">
      <NonogramPractice />
    </main>
  );
}
