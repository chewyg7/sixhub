import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { MEDIA_CATEGORIES } from "@/data/categories";
import { getAllMedia, getCollections, getInfoEntries, getInfoSections } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [media, collections, sections, entries] = await Promise.all([getAllMedia(), getCollections(), getInfoSections(), getInfoEntries()]);
  const u = (path: string, lastModified?: string) => ({ url: `${SITE.url}${path}`, lastModified: lastModified ? new Date(lastModified) : undefined });
  return [
    ...["/", "/news", "/media", "/viewer", "/info", "/timeline", "/collections", "/about", "/contact", "/privacy"].map((p) => u(p)),
    ...MEDIA_CATEGORIES.map((c) => u(`/media/${c.slug}`)),
    ...media.map((m) => u(`/media/${m.slug}`, m.dateAdded)),
    ...collections.map((c) => u(`/collections/${c.slug}`)),
    ...sections.map((s) => u(`/info/${s.slug}`)),
    ...entries.map((e) => u(`/info/${e.section}/${e.slug}`, e.lastReviewed)),
  ];
}
