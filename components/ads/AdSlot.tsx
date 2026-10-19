import "server-only";

export type AdPlacement =
  | "dashboard-between-games-and-history"
  | "leaderboard-after-standings"
  | "profile-after-ratings"
  | "ranked-desktop-rail";

type AdFormat = "banner" | "inline" | "rail";

const FORMAT_CLASSES: Record<AdFormat, string> = {
  banner: "min-h-28 w-full",
  inline: "min-h-40 w-full",
  rail: "hidden h-[600px] w-[160px] shrink-0 min-[1440px]:flex",
};

/**
 * Vendor-neutral ad boundary.
 *
 * This component deliberately contains no third-party script or arbitrary HTML
 * injection. During beta ADS_ENABLED remains false. Designers can opt into a
 * non-production preview with ADS_PLACEHOLDERS_ENABLED=true; a future consent-
 * gated provider adapter can replace the inner placeholder without moving the
 * safe placements in each page.
 */
export function AdSlot({
  placement,
  format = "banner",
  className = "",
}: {
  placement: AdPlacement;
  format?: AdFormat;
  className?: string;
}) {
  const adsEnabled = process.env.ADS_ENABLED === "true";
  const previewEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.ADS_PLACEHOLDERS_ENABLED === "true";

  if (!adsEnabled && !previewEnabled) return null;

  return (
    <aside
      aria-label="Advertisement"
      data-ad-placement={placement}
      data-ad-provider="none"
      className={`${FORMAT_CLASSES[format]} ${className} items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]/45 p-4 text-center`}
    >
      <div>
        <p className="subtle-text text-[10px] font-extrabold uppercase tracking-[0.16em]">
          Advertisement
        </p>
        <p className="subtle-text mt-2 text-xs font-semibold">
          {previewEnabled ? "Placement preview — no ad request is made" : "Reserved ad space"}
        </p>
      </div>
    </aside>
  );
}
