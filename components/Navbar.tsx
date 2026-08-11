import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          compPuzzles
        </Link>
        <div className="flex items-center gap-4">
          <Show when="signed-in">
            <Link href="/dashboard" className="text-sm font-medium hover:underline">
              Dashboard
            </Link>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="text-sm font-medium hover:underline">Sign in</button>
            </SignInButton>
          </Show>
        </div>
      </nav>
    </header>
  );
}
