import "server-only";
import { bumpContentVersion, db, fromJson, now, toJson } from "./index";

/* ------------------------------------------------------------------ */
/* Custom pages (/p/<slug>), written in Markdown in the admin panel     */
/* ------------------------------------------------------------------ */

export interface CustomPage {
  slug: string;
  title: string;
  description: string;
  body: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: string | null;
}

type PageRow = { slug: string; title: string; data: string; published: number; created_at: number; updated_at: number; updated_by: string | null };
const toPage = (r: PageRow): CustomPage => {
  const d = fromJson<{ description?: string; body?: string }>(r.data, {});
  return { slug: r.slug, title: r.title, description: d.description ?? "", body: d.body ?? "", published: !!r.published, createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by };
};

export function listPages(opts: { published?: boolean } = {}): CustomPage[] {
  const sql = opts.published ? "SELECT * FROM pages WHERE published = 1 ORDER BY title" : "SELECT * FROM pages ORDER BY updated_at DESC";
  return (db().prepare(sql).all() as PageRow[]).map(toPage);
}

export function getPage(slug: string): CustomPage | null {
  const r = db().prepare("SELECT * FROM pages WHERE slug = ?").get(slug) as PageRow | undefined;
  return r ? toPage(r) : null;
}

export function savePage(p: Omit<CustomPage, "createdAt" | "updatedAt">, previousSlug?: string) {
  const d = db();
  const t = now();
  d.transaction(() => {
    const created = previousSlug ? ((d.prepare("SELECT created_at FROM pages WHERE slug = ?").get(previousSlug) as { created_at: number } | undefined)?.created_at ?? t) : t;
    if (previousSlug && previousSlug !== p.slug) d.prepare("DELETE FROM pages WHERE slug = ?").run(previousSlug);
    d.prepare(
      `INSERT INTO pages (slug, title, data, published, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET title = excluded.title, data = excluded.data, published = excluded.published, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).run(p.slug, p.title, toJson({ description: p.description, body: p.body }), p.published ? 1 : 0, created, t, p.updatedBy);
  })();
  bumpContentVersion();
}

export function deletePage(slug: string) {
  db().prepare("DELETE FROM pages WHERE slug = ?").run(slug);
  bumpContentVersion();
}

/* ------------------------------------------------------------------ */
/* Short links (/go/<slug>) with click counts                           */
/* ------------------------------------------------------------------ */

export interface ShortLink {
  slug: string;
  url: string;
  note: string;
  clicks: number;
  lastClickAt: number | null;
  createdAt: number;
  createdBy: string | null;
}

type LinkRow = { slug: string; url: string; note: string; clicks: number; last_click_at: number | null; created_at: number; created_by: string | null };
const toLink = (r: LinkRow): ShortLink => ({ slug: r.slug, url: r.url, note: r.note, clicks: r.clicks, lastClickAt: r.last_click_at, createdAt: r.created_at, createdBy: r.created_by });

export const listShortLinks = () => (db().prepare("SELECT * FROM short_links ORDER BY created_at DESC").all() as LinkRow[]).map(toLink);

export function saveShortLink(l: { slug: string; url: string; note: string; createdBy: string | null }, previousSlug?: string) {
  const d = db();
  d.transaction(() => {
    if (previousSlug && previousSlug !== l.slug) {
      if (d.prepare("SELECT 1 FROM short_links WHERE slug = ?").get(l.slug)) throw new Error(`/go/${l.slug} is already taken.`);
      d.prepare("UPDATE short_links SET slug = ?, url = ?, note = ? WHERE slug = ?").run(l.slug, l.url, l.note, previousSlug);
      return;
    }
    if (!previousSlug && d.prepare("SELECT 1 FROM short_links WHERE slug = ?").get(l.slug)) throw new Error(`/go/${l.slug} is already taken.`);
    d.prepare(
      "INSERT INTO short_links (slug, url, note, created_at, created_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET url = excluded.url, note = excluded.note",
    ).run(l.slug, l.url, l.note, now(), l.createdBy);
  })();
}

export const deleteShortLink = (slug: string) => db().prepare("DELETE FROM short_links WHERE slug = ?").run(slug);

/** Resolves a short link and counts the click. */
export function followShortLink(slug: string): string | null {
  const r = db().prepare("UPDATE short_links SET clicks = clicks + 1, last_click_at = ? WHERE slug = ? RETURNING url").get(now(), slug) as { url: string } | undefined;
  return r?.url ?? null;
}
