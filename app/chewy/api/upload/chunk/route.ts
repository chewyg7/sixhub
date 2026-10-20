import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin, errorResponse } from "@/lib/auth/csrf";
import { checkUploadId, saveChunk, sweepChunks } from "@/lib/media/chunks";
import { MAX_BYTES } from "@/lib/media/sniff";

/**
 * POST /chewy/api/upload/chunk — one piece of a large upload (raw body),
 * identified by `x-upload-id` and its byte `x-upload-offset`. When every piece
 * is in, the uploader calls /chewy/api/upload with the same id to finish.
 * (Keeps each request under Cloudflare's 100 MB limit.)
 */
export const maxDuration = 300;

const HARD_MAX = Math.max(...Object.values(MAX_BYTES));

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    assertSameOrigin(request);
    if (!request.body) throw new Error("No data received.");
    const id = checkUploadId(request.headers.get("x-upload-id"));
    const offset = Number(request.headers.get("x-upload-offset"));
    const size = await saveChunk(request.body, user.id, id, offset, HARD_MAX);
    void sweepChunks();
    return Response.json({ ok: true, size });
  } catch (e) {
    return errorResponse(e);
  }
}
