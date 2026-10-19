import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "comppuzzles-web" },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
