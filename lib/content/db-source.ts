import "server-only";
import type { Collection, FaqEntry, InfoEntry, InfoSection, MediaCategory, MediaFolder, MediaItem, MediaSource, SiteSettings, TimelineEvent } from "@/types/content";
import { contentVersion } from "@/lib/db";
import * as repo from "@/lib/db/content";

/**
 * Public view of the content, built from the database and cached in memory
 * until the content version changes (any admin edit bumps it).
 */
interface Snapshot {
  version: number;
  media: MediaItem[];
  bySlug: Map<string, MediaItem>;
  collections: Collection[];
  folders: MediaFolder[];
  categories: MediaCategory[];
  sources: MediaSource[];
  sections: InfoSection[];
  entries: InfoEntry[];
  timeline: TimelineEvent[];
  faq: FaqEntry[];
  settings: SiteSettings;
}

const globalForSnap = globalThis as unknown as { __gh_snapshot?: Snapshot };

function build(version: number): Snapshot {
  const sources = repo.listSources();
  const sourceBySlug = new Map(sources.map((s) => [s.slug, s]));
  const collections = repo.listCollections();
  const memberships = new Map<string, string[]>();
  for (const c of collections) for (const m of c.mediaSlugs) memberships.set(m, [...(memberships.get(m) ?? []), c.slug]);

  const media: MediaItem[] = repo.listMediaRows().map(({ item }) => {
    const { sourceSlug, ...rest } = item;
    return {
      ...rest,
      source: sourceBySlug.get(sourceSlug) ?? { slug: sourceSlug, label: sourceSlug, origin: "other" },
      collections: memberships.get(item.slug) ?? [],
    };
  });
  const visible = new Set(media.map((m) => m.slug));
  return {
    version,
    media,
    bySlug: new Map(media.map((m) => [m.slug, m])),
    // Hidden media never leaks through collections.
    collections: collections.map((c) => ({ ...c, mediaSlugs: c.mediaSlugs.filter((s) => visible.has(s)) })),
    folders: repo.listFolders(),
    categories: repo.listCategories(),
    sources,
    sections: repo.listInfoSections(),
    entries: repo.listInfoEntries(),
    timeline: repo.listTimeline(),
    faq: repo.listFaq(),
    settings: repo.getSettings(),
  };
}

export function snapshot(): Snapshot {
  const version = contentVersion();
  const cur = globalForSnap.__gh_snapshot;
  if (cur && cur.version === version) return cur;
  const next = build(version);
  globalForSnap.__gh_snapshot = next;
  return next;
}
