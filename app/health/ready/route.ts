import { NextResponse } from "next/server";
import { validateWebRuntimeEnv } from "@/auth/runtimeEnv";

export const dynamic = "force-dynamic";

export function GET() {
  let ready = true;
  try {
    validateWebRuntimeEnv();
  } catch {
    ready = false;
  }
  return NextResponse.json(
    { status: ready ? "ready" : "unavailable", service: "comppuzzles-web" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
