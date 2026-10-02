/**
 * Search engine shared by the command palette and the /search page.
 *
 * Documents are normalized once into token lists; queries match with AND
 * semantics across tokens, scoring title hits above body hits and word
 * prefixes above substrings. This is fast for tens of thousands of docs;
 * for more, swap `searchDocs` for a hosted index (Algolia, Meilisearch,
 * Postgres FTS) behind the same `SearchDoc` shape.
 */

export type SearchDocType = "media" | "news" | "character" | "location" | "info" | "collection" | "timeline" | "page";

export interface SearchDoc {
  id: string;
  type: SearchDocType;
  title: string;
  subtitle?: string;
  href: string;
  /** Extra searchable text (tags, names, descriptions). */
  text?: string;
  thumb?: string;
  date?: string;
  external?: boolean;
  /** For media: slug for "open in viewer". */
  slug?: string;
}

export const GROUP_ORDER: SearchDocType[] = ["page", "character", "location", "media", "collection", "news", "info", "timeline"];

export const GROUP_LABEL: Record<SearchDocType, string> = {
  media: "Media",
  news: "News",
  character: "Characters",
  location: "Locations",
  info: "Information",
  collection: "Collections",
  timeline: "Timeline",
  page: "Pages",
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Indexed {
  doc: SearchDoc;
  titleWords: string[];
  title: string;
  body: string;
  bodyWords: string[];
}

export function buildIndex(docs: SearchDoc[]): Indexed[] {
  return docs.map((doc) => {
    const title = normalize(doc.title);
    const body = normalize(`${doc.subtitle ?? ""} ${doc.text ?? ""}`);
    return { doc, title, titleWords: title.split(" "), body, bodyWords: body.split(" ") };
  });
}

const TYPE_BOOST: Partial<Record<SearchDocType, number>> = { character: 3, location: 3, page: 2, collection: 1 };

function scoreToken(ix: Indexed, tok: string): number {
  if (ix.titleWords.includes(tok)) return 10;
  if (ix.titleWords.some((w) => w.startsWith(tok))) return 7;
  if (ix.title.includes(tok)) return 4;
  if (ix.bodyWords.includes(tok)) return 3;
  if (ix.bodyWords.some((w) => w.startsWith(tok))) return 2;
  if (tok.length >= 3 && ix.body.includes(tok)) return 1;
  return 0;
}

export function searchIndex(index: Indexed[], query: string, limit = 200): SearchDoc[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);
  const results: { doc: SearchDoc; score: number }[] = [];
  for (const ix of index) {
    let total = 0;
    let ok = true;
    for (const t of tokens) {
      const s = scoreToken(ix, t);
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (!ok) continue;
    if (ix.title === q) total += 12;
    else if (ix.title.startsWith(q)) total += 6;
    total += TYPE_BOOST[ix.doc.type] ?? 0;
    results.push({ doc: ix.doc, score: total });
  }
  return results
    .sort((a, b) => b.score - a.score || (b.doc.date ?? "").localeCompare(a.doc.date ?? ""))
    .slice(0, limit)
    .map((r) => r.doc);
}

export function groupResults(docs: SearchDoc[], perGroup = 5): { type: SearchDocType; items: SearchDoc[]; total: number }[] {
  const groups = new Map<SearchDocType, SearchDoc[]>();
  for (const d of docs) groups.set(d.type, [...(groups.get(d.type) ?? []), d]);
  // Groups appear in the order of their best-ranked result (Map keeps first-insertion order).
  return [...groups].map(([type, items]) => ({ type, items: items.slice(0, perGroup), total: items.length }));
}

/** Split text into highlighted / plain segments for the query tokens. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const tokens = normalize(query)
    .split(" ")
    .filter((t) => t.length > 0);
  if (!tokens.length) return [{ text, hit: false }];
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, hit: tokens.some((t) => part.toLowerCase() === t) }));
}
