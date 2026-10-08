import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/lib/db";
import { SERVE_TYPES } from "@/lib/media/sniff";

/**
 * GET /files/<area>/<dir>/<file> — serves uploaded media from the data
 * directory. Path segments are restricted to a safe character set, the
 * resolved path must stay inside the uploads folder, and only known media
 * types are served (never HTML or SVG), sandboxed and with nosniff.
 */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

function resolveFile(parts: string[]): string | null {
  if (parts.length < 2 || parts.length > 4) return null;
  if (!["media", "avatars"].includes(parts[0])) return null;
  if (!parts.every((p) => SEGMENT.test(p) && !p.includes(".."))) return null;
  const full = path.resolve(UPLOAD_DIR, ...parts);
  if (!full.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return null;
  return full;
}

async function serve(request: NextRequest, ctx: RouteContext<"/files/[...path]">, head: boolean) {
  const { path: parts } = await ctx.params;
  const file = resolveFile(parts);
  const ext = parts.at(-1)?.split(".").pop()?.toLowerCase() ?? "";
  const type = SERVE_TYPES[ext];
  if (!file || !type) return new Response("Not found", { status: 404 });
  const info = await stat(/*turbopackIgnore: true*/ file).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "Cross-Origin-Resource-Policy": "same-origin",
  });

  const range = request.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m) {
    let start = m[1] ? Number(m[1]) : NaN;
    let end = m[2] ? Number(m[2]) : info.size - 1;
    if (Number.isNaN(start)) {
      start = Math.max(0, info.size - end);
      end = info.size - 1;
    }
    end = Math.min(end, info.size - 1);
    if (start > end || start >= info.size) {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const body = head ? null : (Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ file, { start, end })) as ReadableStream);
    return new Response(body, { status: 206, headers });
  }
  headers.set("Content-Length", String(info.size));
  return new Response(head ? null : (Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ file)) as ReadableStream), { status: 200, headers });
}

export function GET(request: NextRequest, ctx: RouteContext<"/files/[...path]">) {
  return serve(request, ctx, false);
}

export function HEAD(request: NextRequest, ctx: RouteContext<"/files/[...path]">) {
  return serve(request, ctx, true);
}
