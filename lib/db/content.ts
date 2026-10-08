import "server-only";
import { randomUUID } from "node:crypto";
import type { Collection, FaqEntry, InfoEntry, InfoSection, MediaCategory, MediaFolder, MediaItem, MediaSource, SiteSettings, TimelineEvent } from "@/types/content";
import { DEFAULT_SETTINGS } from "@/data/settings";
import { slugify } from "@/lib/slug";
import { splitFontName } from "@/lib/media/font-family";
import { bumpContentVersion, db, fromJson, now, toJson } from "./index";

/**
 * Content repository. All reads and writes of site content go through here;
 * every write bumps the content version so cached snapshots rebuild.
 */

/** A media row as stored: the source is referenced by slug, collections are derived. */
export type StoredMedia = Omit<MediaItem, "source" | "collections"> & { sourceSlug: string };

export type MediaStatus = "published" | "pending";

export interface MediaRow {
  item: StoredMedia;
  hidden: boolean;
  status: MediaStatus;
  originKey: string | null;
  createdBy: string | null;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

type RawMedia = { slug: string; data: string; hidden: number; status: MediaStatus; origin_key: string | null; created_by: string | null; updated_at: number };
const toRow = (r: RawMedia): MediaRow => ({
  item: fromJson<StoredMedia>(r.data, {} as StoredMedia),
  hidden: !!r.hidden,
  status: r.status,
  originKey: r.origin_key,
  createdBy: r.created_by,
  updatedAt: r.updated_at,
});
const MEDIA_COLS = "slug, data, hidden, status, origin_key, created_by, updated_at";

/** Public reads see published, unhidden media only; the admin panel passes `all`. */
export function listMediaRows(opts: { all?: boolean } = {}): MediaRow[] {
  const rows = db()
    .prepare(`SELECT ${MEDIA_COLS} FROM media ${opts.all ? "" : "WHERE hidden = 0 AND status = 'published'"}`)
    .all() as RawMedia[];
  return rows.map(toRow);
}

export function getMediaRow(slug: string): MediaRow | null {
  const r = db().prepare(`SELECT ${MEDIA_COLS} FROM media WHERE slug = ?`).get(slug) as RawMedia | undefined;
  return r ? toRow(r) : null;
}

export function mediaSlugExists(slug: string) {
  return !!db().prepare("SELECT 1 FROM media WHERE slug = ?").get(slug);
}

export function originKeysExist(keys: string[]): Set<string> {
  const found = new Set<string>();
  const stmt = db().prepare("SELECT 1 FROM media WHERE origin_key = ?");
  for (const k of keys) if (stmt.get(k)) found.add(k);
  return found;
}

export function upsertMedia(item: StoredMedia, opts: { originKey?: string | null; createdBy?: string | null; hidden?: boolean; status?: MediaStatus } = {}) {
  const existing = getMediaRow(item.slug);
  db()
    .prepare(
      `INSERT INTO media (slug, kind, category, folder_id, title, date_published, date_added, origin_key, hidden, status, data, created_by, updated_at)
       VALUES (@slug, @kind, @category, @folder, @title, @published, @added, @origin, @hidden, @status, @data, @createdBy, @t)
       ON CONFLICT(slug) DO UPDATE SET kind = excluded.kind, category = excluded.category, folder_id = excluded.folder_id, title = excluded.title,
         date_published = excluded.date_published, date_added = excluded.date_added, hidden = excluded.hidden, status = excluded.status, data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run({
      slug: item.slug,
      kind: item.kind,
      category: item.category,
      folder: item.folderId ?? "",
      title: item.title,
      published: item.datePublished,
      added: item.dateAdded,
      origin: opts.originKey ?? existing?.originKey ?? null,
      hidden: (opts.hidden ?? existing?.hidden ?? false) ? 1 : 0,
      status: opts.status ?? existing?.status ?? "published",
      data: toJson({ ...item, id: item.slug }),
      createdBy: opts.createdBy ?? existing?.createdBy ?? null,
      t: now(),
    });
  bumpContentVersion();
}

export function setMediaStatus(slugs: string[], status: MediaStatus) {
  const stmt = db().prepare("UPDATE media SET status = ?, updated_at = ? WHERE slug = ?");
  db().transaction(() => slugs.forEach((s) => stmt.run(status, now(), s)))();
  bumpContentVersion();
}

export function setMediaHidden(slugs: string[], hidden: boolean) {
  const stmt = db().prepare("UPDATE media SET hidden = ?, updated_at = ? WHERE slug = ?");
  db().transaction(() => slugs.forEach((s) => stmt.run(hidden ? 1 : 0, now(), s)))();
  bumpContentVersion();
}

export function moveMedia(slugs: string[], folderId: string) {
  const d = db();
  d.transaction(() => {
    for (const s of slugs) {
      const row = getMediaRow(s);
      if (!row) continue;
      row.item.folderId = folderId;
      d.prepare("UPDATE media SET folder_id = ?, data = ?, updated_at = ? WHERE slug = ?").run(folderId, toJson(row.item), now(), s);
    }
  })();
  bumpContentVersion();
}

/** Removes media rows and returns them (so callers can delete uploaded files). */
export function deleteMedia(slugs: string[]): MediaRow[] {
  const d = db();
  const removed: MediaRow[] = [];
  d.transaction(() => {
    for (const s of slugs) {
      const row = getMediaRow(s);
      if (!row) continue;
      d.prepare("DELETE FROM media WHERE slug = ?").run(s);
      removed.push(row);
    }
    // Drop the slugs from collections, folder covers and settings that point at them.
    for (const c of listCollections()) {
      const left = c.mediaSlugs.filter((m) => !slugs.includes(m));
      if (left.length !== c.mediaSlugs.length) saveCollection({ ...c, mediaSlugs: left, coverSlug: slugs.includes(c.coverSlug) ? (left[0] ?? "") : c.coverSlug });
    }
    d.prepare(`UPDATE folders SET cover_slug = NULL WHERE cover_slug IN (${slugs.map(() => "?").join(",")})`).run(...slugs);
  })();
  bumpContentVersion();
  return removed;
}

export function renameMediaSlug(from: string, to: string) {
  const d = db();
  const row = getMediaRow(from);
  if (!row) throw new Error("Media not found");
  if (mediaSlugExists(to)) throw new Error("That slug is already taken");
  d.transaction(() => {
    d.prepare("UPDATE media SET slug = ?, data = ?, updated_at = ? WHERE slug = ?").run(to, toJson({ ...row.item, slug: to, id: to }), now(), from);
    for (const c of listCollections()) {
      if (!c.mediaSlugs.includes(from) && c.coverSlug !== from) continue;
      saveCollection({ ...c, mediaSlugs: c.mediaSlugs.map((m) => (m === from ? to : m)), coverSlug: c.coverSlug === from ? to : c.coverSlug });
    }
    d.prepare("UPDATE folders SET cover_slug = ? WHERE cover_slug = ?").run(to, from);
  })();
  bumpContentVersion();
}

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

type RawFolder = { id: string; parent_id: string; slug: string; name: string; description: string; cover_slug: string | null; sort: number };
const toFolder = (r: RawFolder): MediaFolder => ({
  id: r.id,
  parentId: r.parent_id || null,
  slug: r.slug,
  name: r.name,
  description: r.description,
  coverSlug: r.cover_slug ?? undefined,
  sort: r.sort,
});

export function listFolders(): MediaFolder[] {
  return (db().prepare("SELECT * FROM folders ORDER BY sort, name").all() as RawFolder[]).map(toFolder);
}

export function getFolder(id: string): MediaFolder | null {
  const r = db().prepare("SELECT * FROM folders WHERE id = ?").get(id) as RawFolder | undefined;
  return r ? toFolder(r) : null;
}

/** All descendants of a folder (not including itself). */
export function folderDescendants(id: string, all = listFolders()): string[] {
  const out: string[] = [];
  const walk = (pid: string) =>
    all
      .filter((f) => f.parentId === pid)
      .forEach((f) => {
        out.push(f.id);
        walk(f.id);
      });
  walk(id);
  return out;
}

export function saveFolder(f: Omit<MediaFolder, "id"> & { id?: string }): MediaFolder {
  const d = db();
  const id = f.id ?? randomUUID();
  const parent = f.parentId ?? "";
  if (f.id && (parent === f.id || folderDescendants(f.id).includes(parent))) throw new Error("A folder can't be moved inside itself");
  const clash = d.prepare("SELECT id FROM folders WHERE parent_id = ? AND slug = ? AND id != ?").get(parent, f.slug, id);
  if (clash) throw new Error("A folder with that URL name already exists here");
  d.prepare(
    `INSERT INTO folders (id, parent_id, slug, name, description, cover_slug, sort, created_at, updated_at) VALUES (@id, @parent, @slug, @name, @description, @cover, @sort, @t, @t)
     ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, slug = excluded.slug, name = excluded.name, description = excluded.description, cover_slug = excluded.cover_slug, sort = excluded.sort, updated_at = excluded.updated_at`,
  ).run({ id, parent, slug: f.slug, name: f.name, description: f.description, cover: f.coverSlug ?? null, sort: f.sort, t: now() });
  bumpContentVersion();
  return { ...f, id, parentId: parent || null };
}

/** The top-level folder fonts are filed under (one sub-folder per family). */
export const FONTS_FOLDER = "fonts";

/** Finds or creates Fonts / <family> and returns its id. */
export function ensureFontFamilyFolder(family: string): string {
  const d = db();
  const slug = slugify(family);
  const found = d.prepare("SELECT id FROM folders WHERE parent_id = ? AND slug = ?").get(FONTS_FOLDER, slug) as { id: string } | undefined;
  if (found) return found.id;
  const sort = (d.prepare("SELECT COUNT(*) AS n FROM folders WHERE parent_id = ?").get(FONTS_FOLDER) as { n: number }).n;
  const id = `${FONTS_FOLDER}/${slug}`;
  const t = now();
  d.prepare("INSERT INTO folders (id, parent_id, slug, name, description, cover_slug, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)").run(
    id,
    FONTS_FOLDER,
    slug,
    family,
    `Every style of ${family}. Try them with your own text.`,
    sort,
    t,
    t,
  );
  bumpContentVersion();
  return id;
}

/**
 * Normalises a font's family/style names and files it into its family's
 * folder when it was put in the top-level Fonts folder (or nowhere).
 */
export function fileFont(item: StoredMedia): StoredMedia {
  if (item.kind !== "font" || !item.font) return item;
  const split = splitFontName(/^regular$/i.test(item.font.style) ? item.font.family : `${item.font.family} ${item.font.style}`);
  const font = { ...item.font, family: split.family, style: split.style };
  const hasFontsFolder = !!db().prepare("SELECT 1 FROM folders WHERE id = ?").get(FONTS_FOLDER);
  const folderId = hasFontsFolder && (!item.folderId || item.folderId === FONTS_FOLDER) ? ensureFontFamilyFolder(font.family) : item.folderId;
  return { ...item, font, folderId };
}

export function folderIsEmpty(id: string): boolean {
  const d = db();
  return !d.prepare("SELECT 1 FROM media WHERE folder_id = ? LIMIT 1").get(id) && !d.prepare("SELECT 1 FROM folders WHERE parent_id = ? LIMIT 1").get(id);
}

/** Deletes a folder. Its media and sub-folders move up to the parent folder. */
export function deleteFolder(id: string) {
  const d = db();
  const f = getFolder(id);
  if (!f) return;
  const parent = f.parentId ?? "";
  d.transaction(() => {
    for (const row of d.prepare("SELECT slug FROM media WHERE folder_id = ?").all(id) as { slug: string }[]) {
      const m = getMediaRow(row.slug)!;
      m.item.folderId = parent;
      d.prepare("UPDATE media SET folder_id = ?, data = ? WHERE slug = ?").run(parent, toJson(m.item), row.slug);
    }
    d.prepare("UPDATE folders SET parent_id = ? WHERE parent_id = ?").run(parent, id);
    d.prepare("DELETE FROM folders WHERE id = ?").run(id);
  })();
  bumpContentVersion();
}

/* ------------------------------------------------------------------ */
/* Simple JSON tables                                                  */
/* ------------------------------------------------------------------ */

function listJson<T>(sql: string): T[] {
  return (db().prepare(sql).all() as { data: string }[]).map((r) => fromJson<T>(r.data, {} as T));
}

export const listCategories = () => listJson<MediaCategory>("SELECT data FROM categories ORDER BY sort, slug");
export function saveCategory(c: MediaCategory) {
  db().prepare("INSERT INTO categories (slug, sort, data) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET sort = excluded.sort, data = excluded.data").run(c.slug, c.order, toJson(c));
  bumpContentVersion();
}
export function deleteCategory(slug: string, moveTo: string) {
  const d = db();
  d.transaction(() => {
    for (const row of d.prepare("SELECT slug FROM media WHERE category = ?").all(slug) as { slug: string }[]) {
      const m = getMediaRow(row.slug)!;
      m.item.category = moveTo;
      d.prepare("UPDATE media SET category = ?, data = ? WHERE slug = ?").run(moveTo, toJson(m.item), row.slug);
    }
    d.prepare("DELETE FROM categories WHERE slug = ?").run(slug);
  })();
  bumpContentVersion();
}

export const listSources = () => listJson<MediaSource>("SELECT data FROM sources ORDER BY slug");
export function saveSource(s: MediaSource) {
  db().prepare("INSERT INTO sources (slug, data) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET data = excluded.data").run(s.slug, toJson(s));
  bumpContentVersion();
}
export function deleteSource(slug: string) {
  const used = (db().prepare("SELECT COUNT(*) n FROM media WHERE json_extract(data, '$.sourceSlug') = ?").get(slug) as { n: number }).n;
  if (used) throw new Error(`${used} media items still use this source`);
  db().prepare("DELETE FROM sources WHERE slug = ?").run(slug);
  bumpContentVersion();
}

export const listCollections = () => listJson<Collection>("SELECT data FROM collections ORDER BY sort, slug");
export function saveCollection(c: Collection, sort?: number) {
  db()
    .prepare("INSERT INTO collections (slug, sort, data) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET data = excluded.data, sort = COALESCE(?, collections.sort)")
    .run(c.slug, sort ?? 1000, toJson(c), sort ?? null);
  bumpContentVersion();
}
export function deleteCollection(slug: string) {
  db().prepare("DELETE FROM collections WHERE slug = ?").run(slug);
  bumpContentVersion();
}

export const listInfoSections = () => listJson<InfoSection>("SELECT data FROM info_sections ORDER BY sort, slug");
export function saveInfoSection(s: InfoSection) {
  db().prepare("INSERT INTO info_sections (slug, sort, data) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET sort = excluded.sort, data = excluded.data").run(s.slug, s.order, toJson(s));
  bumpContentVersion();
}
export function deleteInfoSection(slug: string) {
  const n = (db().prepare("SELECT COUNT(*) n FROM info_entries WHERE section = ?").get(slug) as { n: number }).n;
  if (n) throw new Error(`Move or delete the ${n} entries in this section first`);
  db().prepare("DELETE FROM info_sections WHERE slug = ?").run(slug);
  bumpContentVersion();
}

export const listInfoEntries = () => listJson<InfoEntry>("SELECT data FROM info_entries ORDER BY sort, slug");
export function saveInfoEntry(e: InfoEntry, sort?: number) {
  const d = db();
  const clash = d.prepare("SELECT id FROM info_entries WHERE section = ? AND slug = ? AND id != ?").get(e.section, e.slug, e.id);
  if (clash) throw new Error("Another entry in this section already uses that URL name");
  d.prepare(
    "INSERT INTO info_entries (id, section, slug, sort, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET section = excluded.section, slug = excluded.slug, data = excluded.data, sort = COALESCE(?, info_entries.sort)",
  ).run(e.id, e.section, e.slug, sort ?? 1000, toJson(e), sort ?? null);
  bumpContentVersion();
}
export function deleteInfoEntry(id: string) {
  db().prepare("DELETE FROM info_entries WHERE id = ?").run(id);
  bumpContentVersion();
}

export const listTimeline = () => listJson<TimelineEvent>("SELECT data FROM timeline ORDER BY date");
export function saveTimelineEvent(e: TimelineEvent) {
  db().prepare("INSERT INTO timeline (id, date, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET date = excluded.date, data = excluded.data").run(e.id, e.date, toJson(e));
  bumpContentVersion();
}
export function deleteTimelineEvent(id: string) {
  db().prepare("DELETE FROM timeline WHERE id = ?").run(id);
  bumpContentVersion();
}

export const listFaq = () => listJson<FaqEntry>("SELECT data FROM faq ORDER BY sort, id");
export function saveFaq(f: FaqEntry) {
  db().prepare("INSERT INTO faq (id, sort, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET sort = excluded.sort, data = excluded.data").run(f.id, f.sort, toJson(f));
  bumpContentVersion();
}
export function deleteFaq(id: string) {
  db().prepare("DELETE FROM faq WHERE id = ?").run(id);
  bumpContentVersion();
}

export interface TagRow {
  slug: string;
  label: string;
}
export const listTags = () => db().prepare("SELECT slug, label FROM tags ORDER BY label").all() as TagRow[];
export function saveTag(t: TagRow) {
  db().prepare("INSERT INTO tags (slug, label, created_at) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET label = excluded.label").run(t.slug, t.label, now());
  bumpContentVersion();
}
/** Renames (or, with `to` null, removes) a tag on every media item that has it. */
export function retag(from: string, to: string | null) {
  const d = db();
  d.transaction(() => {
    for (const r of d.prepare("SELECT slug FROM media WHERE EXISTS (SELECT 1 FROM json_each(media.data, '$.tags') WHERE value = ?)").all(from) as { slug: string }[]) {
      const m = getMediaRow(r.slug)!;
      const tags = m.item.tags.filter((t) => t !== from);
      if (to && !tags.includes(to)) tags.push(to);
      m.item.tags = tags;
      d.prepare("UPDATE media SET data = ? WHERE slug = ?").run(toJson(m.item), r.slug);
    }
    if (to === null) d.prepare("DELETE FROM tags WHERE label = ?").run(from);
  })();
  bumpContentVersion();
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function getSettings(): SiteSettings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const stored = Object.fromEntries(rows.map((r) => [r.key, fromJson<unknown>(r.value, null)]));
  // Merge over defaults so settings added in later versions always have a value.
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    release: { ...DEFAULT_SETTINGS.release, ...(stored.release as object) },
    socials: { ...DEFAULT_SETTINGS.socials, ...(stored.socials as object) },
    announcement: { ...DEFAULT_SETTINGS.announcement, ...(stored.announcement as object) },
    home: { ...DEFAULT_SETTINGS.home, ...(stored.home as object) },
    site: normalizeSite(stored.site as Partial<SiteSettings["site"]> | null),
    maintenance: { ...DEFAULT_SETTINGS.maintenance, ...(stored.maintenance as object) },
  } as SiteSettings;
}

/** Fills gaps in stored site content and keeps every home section exactly once. */
function normalizeSite(s: Partial<SiteSettings["site"]> | null): SiteSettings["site"] {
  const d = DEFAULT_SETTINGS.site;
  const stored = (s?.sections ?? []).filter((x) => d.sections.some((y) => y.id === x.id));
  const seen = new Set(stored.map((x) => x.id));
  return {
    ...d,
    ...s,
    footer: { ...d.footer, ...s?.footer },
    sections: [...stored, ...d.sections.filter((x) => !seen.has(x.id))],
    nav: s?.nav?.length ? s.nav : d.nav,
    menu: s?.menu?.length ? s.menu : d.menu,
    marquee: s?.marquee?.length ? s.marquee : d.marquee,
  };
}

export function saveSettings<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, toJson(value));
  bumpContentVersion();
}
