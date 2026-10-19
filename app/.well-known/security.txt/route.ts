import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function oneLine(value: string): string {
  return value.replace(/[\r\n]/g, "").trim();
}

export function GET() {
  const email = oneLine(
    process.env.NEXT_PUBLIC_SECURITY_EMAIL ??
      process.env.NEXT_PUBLIC_PRIVACY_EMAIL ??
      "security@example.invalid",
  );
  const configuredSiteUrl = oneLine(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid",
  );
  let siteOrigin = "https://example.invalid";
  try {
    siteOrigin = new URL(configuredSiteUrl).origin;
  } catch {
    // Production env validation rejects this fallback before deployment.
  }

  const expires = new Date();
  expires.setUTCMonth(expires.getUTCMonth() + 6);

  const body = [
    `Contact: mailto:${email}`,
    `Expires: ${expires.toISOString()}`,
    `Canonical: ${siteOrigin}/.well-known/security.txt`,
    `Policy: ${siteOrigin}/legal/contact`,
    "Preferred-Languages: en, it",
    "Hiring: false",
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
