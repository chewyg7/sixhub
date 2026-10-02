import type { Collection, InfoEntry, InfoSection, InfoSectionSlug, MediaItem, TimelineEvent } from "@/types/content";

/**
 * The boundary between GTA 6 Hub and wherever its content lives.
 *
 * Pages and components never import from `data/` directly; they call the
 * functions in `lib/content/index.ts`, which delegate to a ContentSource.
 * To move to Sanity, Supabase/PostgreSQL, Directus, Strapi or a custom
 * CMS, implement this interface (mapping documents to the types in
 * `types/content.ts`) and swap the export in `lib/content/index.ts`.
 */
export interface ContentSource {
  listMedia(): Promise<MediaItem[]>;
  getMedia(slug: string): Promise<MediaItem | null>;

  listCollections(): Promise<Collection[]>;
  getCollection(slug: string): Promise<Collection | null>;

  listInfoSections(): Promise<InfoSection[]>;
  listInfoEntries(section?: InfoSectionSlug): Promise<InfoEntry[]>;
  getInfoEntry(section: InfoSectionSlug, slug: string): Promise<InfoEntry | null>;

  listTimeline(): Promise<TimelineEvent[]>;
}
