import "server-only";
import type { NewsArticle, NewsImage, NewsPage, NewsScope } from "@/types/news";
import { SITE } from "@/lib/site";
import { excerpt, parseRss, safeHttpUrl, stripHtml, type RawFeedItem } from "./rss";

/**
 * RockstarINTEL news source.
 *
 * Articles come from the site's public WordPress RSS feeds, fetched on the
 * server (no CORS issues, cached with ISR). The feed has no featured
 * images, so images are enriched in one batched request per page from the
 * public WordPress REST API (Open Graph image), falling back to the first
 * editorial image in the article body. Only headline, excerpt and image
 * are shown; readers are sent to the original article.
 */
const ORIGIN = "https://rockstarintel.com";
const FEED_REVALIDATE = 600; // 10 minutes
const IMAGE_REVALIDATE = 60 * 60 * 6;
const USER_AGENT = `Mozilla/5.0 (compatible; GTA6HubBot/1.0; +${SITE.url})`;

export class NewsFetchError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "NewsFetchError";
  }
}

export function feedUrl(scope: NewsScope, page: number, query?: string): string {
  const q = query?.trim();
  if (q) {
    const u = new URL(ORIGIN + "/");
    u.searchParams.set("s", q);
    if (scope === "gta6") u.searchParams.set("category_name", "gta-6");
    u.searchParams.set("feed", "rss2");
    if (page > 1) u.searchParams.set("paged", String(page));
    return u.toString();
  }
  const base = scope === "gta6" ? `${ORIGIN}/category/gta-6/feed/` : `${ORIGIN}/feed/`;
  return page > 1 ? `${base}?paged=${page}` : base;
}

function postIdFromGuid(guid: string): string | null {
  const m = /[?&]p=(\d+)/.exec(guid);
  return m ? m[1] : null;
}

const IGNORED_IMAGE = /(preferred_source_badge|gravatar|emoji|\/plugins\/|logo[-_]?\d*\.(png|svg)|avatar)/i;

function firstContentImage(html: string): NewsImage | undefined {
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = /\ssrc="([^"]+)"/i.exec(tag)?.[1];
    const url = safeHttpUrl(src);
    if (!url || IGNORED_IMAGE.test(url)) continue;
    const width = Number(/\swidth="(\d+)"/i.exec(tag)?.[1]) || undefined;
    if (width && width < 300) continue;
    const alt = /\salt="([^"]*)"/i.exec(tag)?.[1];
    return { url, width, height: Number(/\sheight="(\d+)"/i.exec(tag)?.[1]) || undefined, alt: alt ? stripHtml(alt) : undefined };
  }
  return undefined;
}

async function fetchOgImages(ids: string[]): Promise<Record<string, NewsImage>> {
  if (ids.length === 0) return {};
  const url = `${ORIGIN}/wp-json/wp/v2/posts?include=${ids.join(",")}&per_page=${ids.length}&_fields=id,yoast_head_json.og_image`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, next: { revalidate: IMAGE_REVALIDATE, tags: ["news-images"] } });
    if (!res.ok) return {};
    const data = (await res.json()) as { id: number; yoast_head_json?: { og_image?: { url: string; width?: number; height?: number }[] } }[];
    const out: Record<string, NewsImage> = {};
    for (const p of data) {
      const og = p.yoast_head_json?.og_image?.[0];
      const u = safeHttpUrl(og?.url);
      if (u) out[String(p.id)] = { url: u, width: og?.width, height: og?.height };
    }
    return out;
  } catch {
    // Images are an enhancement; the feed still renders without them.
    return {};
  }
}

function toArticle(raw: RawFeedItem, og: Record<string, NewsImage>): NewsArticle | null {
  const link = safeHttpUrl(raw.link);
  if (!link || !raw.title) return null;
  const published = new Date(raw.pubDate);
  const id = postIdFromGuid(raw.guid) ?? link;
  const summary = stripHtml(raw.descriptionHtml)
    .replace(/The post .+? appeared first on .+?\.$/, "")
    .replace(/\s*\[(…|\.\.\.)\]\s*$/, "")
    .trim();
  const fromOg = postIdFromGuid(raw.guid) ? og[postIdFromGuid(raw.guid)!] : undefined;
  const image = fromOg ?? firstContentImage(raw.contentHtml);
  return {
    id: `rockstarintel-${id}`,
    title: raw.title,
    url: link,
    publishedAt: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
    excerpt: excerpt(summary),
    author: raw.creator,
    categories: [...new Set(raw.categories)].slice(0, 8),
    image: image ? { ...image, alt: image.alt ?? "" } : undefined,
    source: { name: "RockstarINTEL", url: ORIGIN },
  };
}

export async function fetchRockstarIntel({ scope = "gta6", page = 1, query }: { scope?: NewsScope; page?: number; query?: string } = {}): Promise<NewsPage> {
  const url = feedUrl(scope, page, query);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
      next: { revalidate: FEED_REVALIDATE, tags: ["news"] },
    });
  } catch (e) {
    throw new NewsFetchError(`Could not reach RockstarINTEL (${(e as Error).message})`);
  }
  // WordPress returns 404 once `paged` runs past the last page.
  if (res.status === 404 && page > 1) {
    return { articles: [], page, hasMore: false, scope, query, fetchedAt: new Date().toISOString() };
  }
  if (!res.ok) throw new NewsFetchError(`RockstarINTEL responded with ${res.status}`, res.status);

  const raws = parseRss(await res.text());
  const ids = raws.map((r) => postIdFromGuid(r.guid)).filter((x): x is string => Boolean(x));
  const og = await fetchOgImages(ids);
  const articles = raws.map((r) => toArticle(r, og)).filter((a): a is NewsArticle => Boolean(a));
  return {
    articles,
    page,
    // WordPress feeds serve 10 items per page by default.
    hasMore: raws.length >= 10,
    scope,
    query,
    fetchedAt: new Date().toISOString(),
  };
}
