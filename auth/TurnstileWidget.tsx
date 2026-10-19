"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ action }: { action: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      appearance: "interaction-only",
      theme: "light",
    });
  }, [action, siteKey]);

  const announceReady = useCallback(() => {
    window.dispatchEvent(new Event("comppuzzles:turnstile-ready"));
    renderWidget();
  }, [renderWidget]);

  useEffect(() => {
    window.addEventListener("comppuzzles:turnstile-ready", renderWidget);
    renderWidget();
    return () => {
      window.removeEventListener("comppuzzles:turnstile-ready", renderWidget);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  if (!siteKey) {
    // An explicit bypass is server-side and development-only. The empty
    // placeholder avoids leaking any secret or pretending CAPTCHA succeeded.
    return <div className="min-h-1" aria-hidden="true" />;
  }

  return (
    <>
      <Script
        id="turnstile-api"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={announceReady}
      />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Security verification" />
    </>
  );
}
