import type { NextRequest } from "next/server";
import { followShortLink } from "@/lib/db/extras";

/** GET /go/<slug> — short links made in the admin panel. Counts the click and redirects. */
export async function GET(request: NextRequest, ctx: RouteContext<"/go/[slug]">) {
  const { slug } = await ctx.params;
  const url = /^[a-z0-9-]{1,80}$/.test(slug) ? followShortLink(slug) : null;
  if (!url) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  return new Response(null, { status: 302, headers: { Location: new URL(url, request.nextUrl.origin).toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" } });
}
