import "server-only";
import type Database from "better-sqlite3";
import type { Collection, FaqEntry, MediaCategory, MediaFolder, SiteSettings } from "@/types/content";
import type { StoredMedia } from "./content";
import { INFO_ENTRIES, INFO_SECTIONS } from "@/data/info";
import { TIMELINE } from "@/data/timeline";
import { MEDIA_SOURCES } from "@/data/sources";
import { DEFAULT_CATEGORIES } from "@/data/categories";
import { DEFAULT_FAQ } from "@/data/faq";
import { DEFAULT_SETTINGS } from "@/data/settings";
import { TRAILER_RECORDS } from "@/data/trailers";
import gtaviceJson from "@/data/generated/gtavice.json";
import trailersJson from "@/data/generated/trailers.json";
import brandJson from "@/data/generated/brand.json";
import { placeGvItem } from "@/lib/grabber/placement";

/**
 * First-run content: everything the site shipped with before the database
 * existed. Runs once, when the media table is empty. After that the admin
 * panel is the source of truth and these files are never read again.
 */
export function seedIfEmpty(db: Database.Database) {
  const has = db.prepare("SELECT 1 FROM media LIMIT 1").get();
  if (has) return;
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM media LIMIT 1").get()) return; // another process seeded while we waited
    seed(db);
  }).immediate();
}

/* ------------------------------------------------------------------ */
/* Imported data shapes                                                */
/* ------------------------------------------------------------------ */

interface GvItem {
  slug: string;
  title: string;
  category: string;
  source: string;
  datePublished: string;
  dateAdded: string;
  width: number;
  height: number;
  original: StoredMedia["original"];
  variants: StoredMedia["variants"];
  dominantColor: string | null;
  characters: string[];
  locations: string[];
  via: string;
  /** Path of the file on gtavice.net, e.g. /content/images/…/file.jpg. */
  upstream: string;
}
interface GvCollection {
  slug: string;
  title: string;
  kind: "release" | "curated";
  date: string | null;
  description: string;
  via: string;
  mediaSlugs: string[];
}
const gv = gtaviceJson as unknown as { items: GvItem[]; collections: GvCollection[] };
const trailerAssets = trailersJson as unknown as Record<string, Partial<StoredMedia> & { kind: "video" }>;
const brand = brandJson as unknown as { items: (Partial<StoredMedia> & { slug: string; title: string; kind: StoredMedia["kind"]; category: string; tags: string[] })[] };

/** Public collection slugs for the imported galleries. */
const COLLECTION_ALIAS: Record<string, { slug: string; prepend?: string[]; timelineEventId?: string; cover?: string }> = {
  "trailer-2-screencaps": { slug: "trailer-2", prepend: ["gta-vi-trailer-2"], timelineEventId: "2025-05-06-trailer-2" },
  "trailer-1-screencaps": { slug: "trailer-1", prepend: ["gta-vi-trailer-1"], timelineEventId: "2023-12-04-trailer-1" },
  "official-screenshots-may-6-2025": { slug: "screenshots-may-2025", timelineEventId: "2025-05-06-website", cover: "gv-vice-city-01" },
  "official-artwork-may-6-2025": { slug: "artwork-may-2025", cover: "gv-jason-and-lucia-01-landscape" },
  "an-extended-look-screencaps": { slug: "extended-look", prepend: ["gta-vi-extended-look"], timelineEventId: "2026-08-27-extended-look" },
  "official-cover-art-reveal": { slug: "cover-art", timelineEventId: "2026-06-18-cover-art", cover: "gv-gta-6-official-cover-art-landscape" },
  "official-pre-order-artwork": { slug: "pre-order-artwork" },
  "official-pre-order-screenshots": { slug: "pre-order-screenshots" },
  "netflix-announcement-aug-6-2026": { slug: "netflix-announcement", timelineEventId: "2026-08-06-netflix" },
  "official-previews-screenshots-and-artwork": { slug: "previews" },
  "official-website-screengrabs": { slug: "website-screengrabs" },
  "soundtrack-artwork": { slug: "soundtrack-artwork" },
  "official-merchandise": { slug: "merchandise" },
};

/* ------------------------------------------------------------------ */
/* Folder tree                                                         */
/* ------------------------------------------------------------------ */

const characters = INFO_ENTRIES.filter((e) => e.section === "characters");
const locations = INFO_ENTRIES.filter((e) => e.section === "locations");

type FolderSpec = { slug: string; name: string; description?: string; children?: FolderSpec[] };

const people = (): FolderSpec[] => [
  ...characters.map((c) => ({ slug: c.slug, name: c.name })),
  { slug: "jason-and-lucia", name: "Jason & Lucia" },
];
const places = (): FolderSpec[] => locations.map((l) => ({ slug: l.slug, name: l.name }));

const TREE: FolderSpec[] = [
  {
    slug: "screenshots",
    name: "Screenshots",
    description: "Official in-game screenshots released by Rockstar Games.",
    children: [
      { slug: "characters", name: "Characters", children: people() },
      { slug: "locations", name: "Locations", children: places() },
      { slug: "pre-order", name: "Pre-Order Editions" },
      { slug: "previews", name: "Press Previews" },
    ],
  },
  {
    slug: "screengrabs",
    name: "Screengrabs",
    description: "Frames captured from the official trailers and the Rockstar website.",
    children: [
      { slug: "trailer-1", name: "Trailer 1" },
      { slug: "trailer-2", name: "Trailer 2" },
      { slug: "extended-look", name: "An Extended Look" },
      { slug: "website", name: "Official Website" },
    ],
  },
  {
    slug: "artwork",
    name: "Artwork",
    description: "Key art, character art, posters and illustrated pieces.",
    children: [
      { slug: "trailer-1", name: "Trailer 1" },
      { slug: "trailer-2", name: "Trailer 2" },
      { slug: "characters", name: "Characters", children: characters.map((c) => ({ slug: c.slug, name: c.name })) },
      { slug: "locations", name: "Locations", children: places() },
      { slug: "landmarks", name: "Landmarks" },
      { slug: "cover-art", name: "Cover Art" },
      { slug: "pre-order", name: "Pre-Order" },
      { slug: "soundtrack", name: "Soundtrack" },
    ],
  },
  { slug: "videos", name: "Videos", description: "Official trailers and gameplay presentations." },
  { slug: "logos", name: "Logos", description: "Official Grand Theft Auto VI logos and marks." },
  { slug: "fonts", name: "Fonts", description: "Typefaces in the Grand Theft Auto VI style." },
  {
    slug: "promotional",
    name: "Promotional",
    description: "Merchandise, partnerships and campaign material.",
    children: [
      { slug: "merchandise", name: "Merchandise" },
      { slug: "netflix", name: "Netflix Announcement" },
    ],
  },
];

/** Folder ids are their seed path ("artwork/characters/lucia-caminos"); new folders get random ids. */
function flatten(specs: FolderSpec[], parent: string | null, out: MediaFolder[] = []): MediaFolder[] {
  specs.forEach((f, i) => {
    const id = parent ? `${parent}/${f.slug}` : f.slug;
    out.push({ id, parentId: parent, slug: f.slug, name: f.name, description: f.description ?? "", sort: i });
    if (f.children) flatten(f.children, id, out);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

function seed(db: Database.Database) {
  const t = Date.now();
  const json = (v: unknown) => JSON.stringify(v);

  // Folders
  const folders = flatten(TREE, null);
  const insFolder = db.prepare("INSERT INTO folders (id, parent_id, slug, name, description, cover_slug, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)");
  for (const f of folders) insFolder.run(f.id, f.parentId ?? "", f.slug, f.name, f.description, f.sort, t, t);

  // Taxonomy
  const insCategory = db.prepare("INSERT INTO categories (slug, sort, data) VALUES (?, ?, ?)");
  DEFAULT_CATEGORIES.forEach((c: MediaCategory) => insCategory.run(c.slug, c.order, json(c)));
  const insSource = db.prepare("INSERT INTO sources (slug, data) VALUES (?, ?)");
  for (const s of MEDIA_SOURCES) insSource.run(s.slug, json(s));

  // Media
  const insMedia = db.prepare(
    "INSERT INTO media (slug, kind, category, folder_id, title, date_published, date_added, origin_key, hidden, data, created_by, updated_at) VALUES (@slug, @kind, @category, @folderId, @title, @datePublished, @dateAdded, @originKey, 0, @data, NULL, @t)",
  );
  const put = (m: StoredMedia, originKey: string | null) =>
    insMedia.run({ slug: m.slug, kind: m.kind, category: m.category, folderId: m.folderId ?? "", title: m.title, datePublished: m.datePublished, dateAdded: m.dateAdded, originKey, data: json(m), t });

  const galleryOf = new Map<string, string>();
  for (const c of gv.collections) for (const s of c.mediaSlugs) if (!galleryOf.has(s) || c.slug === "official-merchandise") galleryOf.set(s, c.slug);

  for (const i of gv.items) {
    const where = placeGvItem(galleryOf.get(i.slug) ?? "", i.slug, i.characters, i.locations, i.category);
    put(
      {
        id: i.slug,
        slug: i.slug,
        title: i.title,
        kind: "image",
        category: where.category,
        folderId: where.folder,
        description: `${i.title}. Official Grand Theft Auto VI image from Rockstar Games.`,
        alt: i.title,
        datePublished: i.datePublished,
        dateAdded: i.dateAdded,
        sourceSlug: i.source,
        officialUrl: i.via,
        width: i.width,
        height: i.height,
        original: i.original,
        variants: i.variants,
        dominantColor: i.dominantColor,
        tags: [],
        characters: i.characters,
        locations: i.locations,
        downloadable: true,
        credit: "Rockstar Games",
        verification: "official",
      },
      `gtavice:${i.upstream}`,
    );
  }

  for (const r of TRAILER_RECORDS) {
    const a = trailerAssets[r.slug];
    if (!a) continue;
    put(
      {
        id: r.slug,
        slug: r.slug,
        title: r.title,
        kind: "video",
        category: r.category,
        folderId: "videos",
        description: r.description,
        alt: r.alt,
        datePublished: r.datePublished,
        dateAdded: r.dateAdded,
        sourceSlug: r.source,
        officialUrl: r.officialUrl,
        width: a.original?.width,
        height: a.original?.height,
        original: a.original!,
        variants: a.variants ?? [],
        poster: a.poster ? { ...a.poster, mimeType: "image/jpeg", filename: "poster.jpg" } : undefined,
        blurDataUrl: a.blurDataUrl,
        dominantColor: a.dominantColor ?? null,
        video: a.video,
        storyboard: a.storyboard,
        renditions: a.renditions,
        tags: r.tags,
        characters: r.characters,
        locations: r.locations,
        downloadable: r.downloadable,
        credit: r.credit,
        verification: r.verification,
      },
      `trailer:${r.slug}`,
    );
  }

  for (const b of brand.items) {
    const isFont = b.kind === "font";
    put(
      {
        id: b.slug,
        slug: b.slug,
        title: b.title,
        kind: b.kind,
        category: b.category,
        folderId: isFont ? "fonts" : "logos",
        description: isFont
          ? `${b.title}, a typeface in the Grand Theft Auto VI style. Preview it with your own text and download the font file.`
          : `${b.title}, as used on the official Grand Theft Auto VI website.`,
        alt: isFont ? `Type specimen for ${b.title}` : `${b.title} on a transparent background`,
        datePublished: isFont ? "2026-10-08" : "2023-12-04",
        dateAdded: "2026-10-08T09:00:00Z",
        sourceSlug: isFont ? "community" : "rockstar-website",
        officialUrl: b.officialUrl,
        width: b.width,
        height: b.height,
        original: b.original!,
        variants: b.variants ?? [],
        poster: b.poster,
        blurDataUrl: b.blurDataUrl,
        dominantColor: b.dominantColor ?? null,
        font: b.font,
        tags: b.tags,
        characters: [],
        locations: [],
        downloadable: true,
        credit: isFont ? undefined : "Rockstar Games",
        verification: isFont ? "community" : "official",
      },
      `brand:${b.slug}`,
    );
  }

  // Collections
  const insCollection = db.prepare("INSERT INTO collections (slug, sort, data) VALUES (?, ?, ?)");
  gv.collections.forEach((c, i) => {
    const alias = COLLECTION_ALIAS[c.slug] ?? { slug: c.slug };
    const mediaSlugs = [...(alias.prepend ?? []).filter((s) => trailerAssets[s]), ...c.mediaSlugs];
    const col: Collection = {
      slug: alias.slug,
      title: c.title,
      kind: c.kind,
      date: c.date ?? undefined,
      description: c.description,
      coverSlug: alias.cover && c.mediaSlugs.includes(alias.cover) ? alias.cover : c.mediaSlugs[0],
      mediaSlugs,
      sources: [{ label: "GTAVice.net gallery", url: c.via }],
      timelineEventId: alias.timelineEventId,
    };
    insCollection.run(col.slug, i, json(col));
  });

  // Information database & timeline
  const insSection = db.prepare("INSERT INTO info_sections (slug, sort, data) VALUES (?, ?, ?)");
  for (const s of INFO_SECTIONS) insSection.run(s.slug, s.order, json(s));
  const insEntry = db.prepare("INSERT INTO info_entries (id, section, slug, sort, data) VALUES (?, ?, ?, ?, ?)");
  INFO_ENTRIES.forEach((e, i) => insEntry.run(e.id, e.section, e.slug, i, json(e)));
  const insEvent = db.prepare("INSERT INTO timeline (id, date, data) VALUES (?, ?, ?)");
  for (const e of TIMELINE) insEvent.run(e.id, e.date, json(e));

  // FAQ & settings
  const insFaq = db.prepare("INSERT INTO faq (id, sort, data) VALUES (?, ?, ?)");
  DEFAULT_FAQ.forEach((f: FaqEntry) => insFaq.run(f.id, f.sort, json(f)));
  const insSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS satisfies SiteSettings)) insSetting.run(k, json(v));

  db.prepare("INSERT INTO meta (key, value) VALUES ('content_version', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1").run();
  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_at', ?) ON CONFLICT(key) DO NOTHING").run(String(t));
}
