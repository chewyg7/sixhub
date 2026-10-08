import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { errorResponse } from "@/lib/auth/csrf";
import { audit } from "@/lib/auth/audit";
import { backupPath } from "@/lib/admin/system";

/**
 * GET /chewy/api/backup?name=<file> — downloads a database snapshot (owners
 * only). Snapshots include account data, so this only answers same-origin
 * requests from a signed-in owner and every download is audited.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireOwner();
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return Response.json({ error: "Cross-site request refused." }, { status: 403 });
    const name = request.nextUrl.searchParams.get("name") ?? "";
    const file = backupPath(name);
    const info = file ? await stat(/*turbopackIgnore: true*/ file).catch(() => null) : null;
    if (!file || !info?.isFile()) return new Response("Not found", { status: 404 });
    await audit(user, "system.backup.download", name);
    return new Response(Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ file)) as ReadableStream, {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Length": String(info.size),
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
