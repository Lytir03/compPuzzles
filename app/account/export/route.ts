import { exportMyData } from "@/auth/actions";

export async function GET() {
  try {
    const data = await exportMyData();
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="comppuzzles-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Export unavailable" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
