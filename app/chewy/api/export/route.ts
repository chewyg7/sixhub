import type { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { errorResponse } from "@/lib/auth/csrf";
import { audit } from "@/lib/auth/audit";
import { exportContent } from "@/lib/admin/system";

/** GET /chewy/api/export — all site content as JSON (no accounts or sessions). Owners only. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireOwner();
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return Response.json({ error: "Cross-site request refused." }, { status: 403 });
    await audit(user, "system.export");
    const day = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(exportContent(), null, 1), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="gtasixhub-content-${day}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
