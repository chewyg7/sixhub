import type { NextRequest } from "next/server";
import trailers from "@/data/generated/trailers.json";

/**
 * GET /api/video/<slug>
 *
 * Streams a trailer from its host through this origin. Some hosts send no
 * CORS headers, which would leave a cross-origin <video> unreadable to
 * canvas — breaking frame capture, crop export and the pixel inspector.
 * Only slugs listed in the trailer manifest are served (never arbitrary
 * URLs), and Range requests pass straight through so seeking stays instant.
 */
const UPSTREAM = new Map(
  Object.entries(trailers as Record<string, { url: string; proxy: boolean }>)
    .filter(([, t]) => t.proxy)
    .map(([slug, t]) => [slug, t.url]),
);

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

async function stream(request: NextRequest, ctx: RouteContext<"/api/video/[slug]">, method: "GET" | "HEAD") {
  const { slug } = await ctx.params;
  const url = UPSTREAM.get(slug);
  if (!url) return new Response("Not found", { status: 404 });

  const range = request.headers.get("range");
  const upstream = await fetch(url, {
    method,
    headers: range ? { range } : undefined,
    signal: request.signal,
    cache: "no-store",
  }).catch(() => null);
  if (!upstream || (!upstream.ok && upstream.status !== 206)) {
    return new Response("Upstream unavailable", { status: upstream?.status === 416 ? 416 : 502 });
  }

  const headers = new Headers({ "cache-control": "public, max-age=86400, immutable" });
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  return new Response(method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

export function GET(request: NextRequest, ctx: RouteContext<"/api/video/[slug]">) {
  return stream(request, ctx, "GET");
}

export function HEAD(request: NextRequest, ctx: RouteContext<"/api/video/[slug]">) {
  return stream(request, ctx, "HEAD");
}
