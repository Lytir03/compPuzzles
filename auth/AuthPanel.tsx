import Link from "next/link";

export const AUTH_INPUT_CLASS =
  "h-13 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 font-bold outline-none transition placeholder:font-medium placeholder:text-[color-mix(in_srgb,var(--foreground)_35%,transparent)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]";

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 items-center gap-6 px-6 py-12 md:grid-cols-[0.85fr_1.15fr] md:py-20">
      <section className="checker-pattern hidden h-full min-h-[520px] flex-col justify-between overflow-hidden rounded-3xl bg-[#3e6132] p-8 text-white shadow-[0_7px_0_#2b4422] md:flex">
        <div>
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-[#d2edbd]">
            Secure player account
          </span>
          <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.04em]">Your next rival is waiting.</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-white/70">
            Sign in securely, race the same puzzle head-to-head, and keep your rating.
          </p>
        </div>
        <div className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gold)] text-lg text-[#4b380c]">🔒</span>
            <div>
              <p className="text-xs font-bold text-white/60">COMPETITIVE PUZZLES</p>
              <p className="font-black">Verified email · Protected password</p>
            </div>
          </div>
        </div>
      </section>

      <section className="game-panel rounded-3xl p-6 sm:p-9">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{title}</h1>
        <p className="subtle-text mt-3 text-sm font-medium leading-6">{description}</p>
        {children}
        {footer ? <div className="subtle-text mt-6 border-t border-[var(--line)] pt-5 text-sm font-semibold">{footer}</div> : null}
      </section>
    </main>
  );
}

export function AuthMessage({
  message,
  tone = "error",
}: {
  message: string | null;
  tone?: "error" | "success";
}) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
        tone === "error" ? "bg-red-500/10 text-red-700" : "bg-green-600/10 text-green-800"
      }`}
    >
      {message}
    </p>
  );
}

export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-extrabold text-[var(--brand-text)] hover:underline">{children}</Link>;
}
