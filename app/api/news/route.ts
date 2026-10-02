import { NextResponse, type NextRequest } from "next/server";
import { fetchRockstarIntel, NewsFetchError } from "@/lib/news/rockstarintel";
import type { NewsScope } from "@/types/news";

/**
 * GET /api/news?page=1&scope=gta6|all&q=search
 *
 * Server-side proxy + parser for the RockstarINTEL RSS feed. Responses are
 * cached at the edge; upstream fetches are cached by Next for 10 minutes.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.min(Math.max(parseInt(sp.get("page") ?? "1", 10) || 1, 1), 50);
  const scope: NewsScope = sp.get("scope") === "all" ? "all" : "gta6";
  const q = (sp.get("q") ?? "").trim().slice(0, 80) || undefined;

  try {
    const data = await fetchRockstarIntel({ scope, page, query: q });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (e) {
    const status = e instanceof NewsFetchError ? 502 : 500;
    return NextResponse.json({ error: (e as Error).message || "Failed to load news" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
