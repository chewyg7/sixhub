/**
 * Generic RSS 2.0 parsing into plain records. Source-agnostic so other
 * feeds can be added later (see lib/news/rockstarintel.ts for a source).
 */
import { XMLParser } from "fast-xml-parser";

export interface RawFeedItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  creator?: string;
  categories: string[];
  descriptionHtml: string;
  contentHtml: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Keep CDATA/HTML as raw text; we sanitize it ourselves.
  processEntities: false,
  trimValues: true,
  isArray: (name) => name === "item" || name === "category",
});

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  pound: "£",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
}

function unwrapCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

export function parseRss(xml: string): RawFeedItem[] {
  const doc = parser.parse(xml);
  const items: unknown[] = doc?.rss?.channel?.item ?? [];
  return items.map((raw) => {
    const it = raw as Record<string, unknown>;
    const cats = (it.category as unknown[] | undefined) ?? [];
    return {
      guid: unwrapCdata(text(it.guid)),
      title: decodeEntities(unwrapCdata(text(it.title))),
      link: unwrapCdata(text(it.link)),
      pubDate: text(it.pubDate),
      creator: decodeEntities(unwrapCdata(text(it["dc:creator"]))) || undefined,
      categories: cats.map((c) => decodeEntities(unwrapCdata(text(c)))).filter(Boolean),
      descriptionHtml: unwrapCdata(text(it.description)),
      contentHtml: unwrapCdata(text(it["content:encoded"])),
    };
  });
}

export function safeHttpUrl(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Trim to a sentence-ish boundary without cutting words. */
export function excerpt(s: string, max = 240): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > max * 0.6) return cut.slice(0, end + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
}
