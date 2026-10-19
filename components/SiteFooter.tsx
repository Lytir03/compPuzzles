import Link from "next/link";

const LEGAL_LINKS = [
  ["Privacy", "/legal/privacy"],
  ["Terms", "/legal/terms"],
  ["Cookies", "/legal/cookies"],
  ["Cookie preferences", "/legal/cookie-preferences"],
  ["Contact", "/legal/contact"],
] as const;

/** Ready for app/layout.tsx once the shared auth/layout work has settled. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--surface)]/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-black">CompPuzzles</p>
          <p className="subtle-text mt-1 text-xs font-medium">Public beta · No prizes · No active ads</p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
          {LEGAL_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="subtle-text hover:text-[var(--foreground)] hover:underline">
              {label}
            </Link>
          ))}
          <Link href="/it/legal" className="subtle-text hover:text-[var(--foreground)] hover:underline">
            Italiano
          </Link>
        </nav>
      </div>
    </footer>
  );
}
