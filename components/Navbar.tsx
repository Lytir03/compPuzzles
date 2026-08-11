import Link from "next/link";
import { getCurrentUser } from "@/auth/currentUser";
import { logout } from "@/auth/logout";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          compPuzzles
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium hover:underline">
                Dashboard
              </Link>
              <span className="text-sm text-black/60 dark:text-white/60">
                {user.username}
              </span>
              <form action={logout}>
                <button type="submit" className="text-sm font-medium hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/sign-in" className="text-sm font-medium hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
