"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/auth/logout";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Phone navigation. The nav used to hide "Leaderboard" below 460px and
 * "History" below `lg`, which made both routes completely unreachable on a
 * phone — the leaderboard is a headline feature, so that wasn't a tolerable
 * way to lose the link. Everything lives behind one disclosure instead.
 */
export function MobileNav({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const profileHref = `/profile/${encodeURIComponent(username)}`;

  return (
    <div ref={containerRef} className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="soft-button grid h-11 w-11 place-items-center rounded-xl"
      >
        <span className="flex w-5 flex-col gap-[3px]" aria-hidden="true">
          <span
            className={`h-[2.5px] w-full rounded-full bg-current transition-transform ${
              open ? "translate-y-[5.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-[2.5px] w-full rounded-full bg-current transition-opacity ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-[2.5px] w-full rounded-full bg-current transition-transform ${
              open ? "-translate-y-[5.5px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-60 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_12px_30px_rgba(30,35,26,.22)]"
        >
          {/* Each link closes the panel itself — navigating with it open would
              otherwise leave it covering the page it just navigated to. */}
          <MobileNavLink href="/dashboard" label="Game lobby" icon="🎮" onNavigate={close} />
          <MobileNavLink href="/leaderboard" label="Leaderboard" icon="🏆" onNavigate={close} />
          <MobileNavLink href="/matches" label="Match history" icon="📜" onNavigate={close} />
          <MobileNavLink href={profileHref} label="Your profile" icon="◆" onNavigate={close} />
          <MobileNavLink href="/account" label="Account settings" icon="⚙" onNavigate={close} />
          <div className="my-1 border-t border-[var(--line)]" />
          <form action={logout}>
            <SubmitButton
              pendingLabel="Signing out"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--coral)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50"
            >
              <span className="w-5 text-center" aria-hidden="true">
                ↗
              </span>
              Sign out
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

function MobileNavLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition hover:bg-[var(--surface-muted)]"
    >
      <span className="w-5 text-center" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  );
}
