import "server-only";
import { cache } from "react";
import type { InfoSectionSlug, MediaCategorySlug, MediaItem } from "@/types/content";
import type { ContentSource } from "./source";
import { localSource } from "./local-source";
import { byNewest } from "./relations";

/** Swap this for a CMS/database-backed ContentSource. */
const source: ContentSource = localSource;

export const getAllMedia = cache(() => source.listMedia());
export const getMediaBySlug = cache((slug: string) => source.getMedia(slug));
export const getCollections = cache(() => source.listCollections());
export const getCollection = cache((slug: string) => source.getCollection(slug));
export const getInfoSections = cache(() => source.listInfoSections());
export const getInfoEntries = cache((section?: InfoSectionSlug) => source.listInfoEntries(section));
export const getInfoEntry = cache((section: InfoSectionSlug, slug: string) => source.getInfoEntry(section, slug));
export const getTimeline = cache(() => source.listTimeline());

export async function getMediaByCategory(category: MediaCategorySlug): Promise<MediaItem[]> {
  return (await getAllMedia()).filter((m) => m.category === category);
}

export async function getMediaBySlugs(slugs: string[]): Promise<MediaItem[]> {
  const all = await getAllMedia();
  const map = new Map(all.map((m) => [m.slug, m]));
  return slugs.map((s) => map.get(s)).filter((m): m is MediaItem => Boolean(m));
}

export async function getLatestMedia(limit = 12): Promise<MediaItem[]> {
  return [...(await getAllMedia())].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, limit);
}

export async function getNewestPublished(filter: (m: MediaItem) => boolean, limit = 1): Promise<MediaItem[]> {
  return (await getAllMedia()).filter(filter).sort(byNewest).slice(0, limit);
}

/** Lookups for resolving slugs to display names (characters, locations, collections). */
export const getLabelLookups = cache(async () => {
  const [entries, collections] = await Promise.all([getInfoEntries(), getCollections()]);
  return {
    characters: Object.fromEntries(entries.filter((e) => e.section === "characters").map((e) => [e.slug, e.name])),
    locations: Object.fromEntries(entries.filter((e) => e.section === "locations").map((e) => [e.slug, e.name])),
    collections: Object.fromEntries(collections.map((c) => [c.slug, c.title])),
  };
});
