import type { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { errorResponse } from "@/lib/auth/csrf";
import { currentJob, revalidateIfFinished } from "@/lib/grabber/gtavice";

/** GET /chewy/api/grabber — progress of the current import (owners only). */
export async function GET(request: NextRequest) {
  try {
    await requireOwner();
    if (request.headers.get("x-chewy") !== "1") return Response.json({ error: "Missing request header." }, { status: 403 });
    revalidateIfFinished();
    return Response.json({ job: currentJob() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
