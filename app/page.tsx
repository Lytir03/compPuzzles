import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";

const VALUE_PROPS = [
  { icon: "⚡", title: "Fast matchmaking", copy: "Jump into a fair 1v1 puzzle race." },
  { icon: "🧩", title: "Three puzzle games", copy: "Sudoku, Mini Crosswords and Nonograms." },
  { icon: "◆", title: "Your own rating", copy: "Climb a separate ladder for every game." },
  { icon: "🏆", title: "Global ranks", copy: "Win consistently and chase the top spot." },
];

const VALUE_PROP_TONES = [
  "bg-[var(--gold)]",
  "bg-[var(--coral)]",
  "bg-[#8ecb61]",
  "bg-[#6fa9df]",
];

const HERO_PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex-1 overflow-hidden">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_0.88fr] lg:py-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--brand)_38%,var(--line))] bg-[var(--brand-soft)] px-3 py-1.5 text-sm font-extrabold text-[var(--brand-strong)]">
            <span className="h-2 w-2 rounded-full bg-[var(--brand)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_20%,transparent)]" />
            Live puzzle battles
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Think fast.
            <br />
            <span className="text-[var(--brand-strong)]">Outsolve everyone.</span>
          </h1>
          <p className="subtle-text mt-6 max-w-xl text-lg font-medium leading-8 sm:text-xl">
            Race real players in Sudoku, Mini Crosswords and Nonograms, climb a rating in each, and
            turn every quiet puzzle into a proper competition.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="game-button rounded-2xl px-8 py-4 text-center text-lg font-black"
            >
              Play free <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/sign-in"
              className="soft-button rounded-2xl px-7 py-4 text-center text-base font-extrabold"
            >
              I have a username
            </Link>
          </div>
          <div className="subtle-text mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <span>✓ Free to play</span>
            <span>✓ No downloads</span>
            <span>✓ Fair skill matching</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[470px] lg:mx-0 lg:ml-auto">
          <div className="absolute -left-10 top-16 h-28 w-28 rounded-full bg-[color-mix(in_srgb,var(--gold)_38%,transparent)] blur-2xl" />
          <div className="absolute -right-12 bottom-8 h-36 w-36 rounded-full bg-[color-mix(in_srgb,var(--brand)_28%,transparent)] blur-2xl" />
          <div className="game-panel relative rotate-[1.5deg] rounded-[2rem] p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4b91d1] text-sm font-black text-white shadow-[0_3px_0_#2f6d9f]">
                  YOU
                </span>
                <div>
                  <p className="text-sm font-black">Ranked Sudoku</p>
                  <p className="subtle-text text-xs font-semibold">Medium · 1,248 rating</p>
                </div>
              </div>
              <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 font-mono text-sm font-black tabular-nums">
                01:42
              </span>
            </div>

            <div className="grid aspect-square grid-cols-9 overflow-hidden rounded-2xl border-[3px] border-[#3b4036] bg-[#3b4036] shadow-[0_8px_0_#262a22]">
              {HERO_PUZZLE.split("").map((value, index) => {
                const row = Math.floor(index / 9);
                const col = index % 9;
                const selected = index === 40;
                return (
                  <span
                    key={index}
                    className={[
                      "grid place-items-center border-[#d8d4c9] text-[clamp(.7rem,2.4vw,1.25rem)] font-black",
                      "border-b border-r",
                      col === 2 || col === 5 ? "border-r-[3px] border-r-[#3b4036]" : "",
                      row === 2 || row === 5 ? "border-b-[3px] border-b-[#3b4036]" : "",
                      selected ? "bg-[#dbeecb] text-[#4e812e]" : "bg-[#fffdf7]",
                    ].join(" ")}
                  >
                    {selected ? "4" : value === "0" ? "" : value}
                  </span>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl bg-[#2f332d] p-3 text-white">
              <div className="mb-2 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--coral)] text-[10px]">R</span>
                  RivalRook
                </span>
                <span>64%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[64%] rounded-full bg-[var(--gold)]" />
              </div>
            </div>
          </div>
          <div className="absolute -right-3 -top-4 rotate-6 rounded-2xl bg-[var(--gold)] px-4 py-2 text-sm font-black text-[#4b380c] shadow-[0_4px_0_#c28c26] sm:-right-7">
            +18 rating
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-7 flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Built for competition</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">One more game is always tempting.</h2>
          </div>
          <span className="hidden rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-bold sm:block">
            Sudoku · Crosswords · Nonograms — all live
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((prop, index) => (
            <li key={prop.title} className="game-panel rounded-2xl p-5">
              <span
                className={`grid h-11 w-11 place-items-center rounded-xl text-lg shadow-[0_3px_0_rgba(0,0,0,.16)] ${
                  VALUE_PROP_TONES[index % VALUE_PROP_TONES.length]
                }`}
              >
                {prop.icon}
              </span>
              <h3 className="mt-4 font-black">{prop.title}</h3>
              <p className="subtle-text mt-1 text-sm font-medium leading-6">{prop.copy}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
