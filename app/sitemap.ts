import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { flattenTree, getAllMedia, getCategories, getCollections, getFolderTree, getInfoEntries, getInfoSections } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [media, collections, sections, entries, categories, folders] = await Promise.all([getAllMedia(), getCollections(), getInfoSections(), getInfoEntries(), getCategories(), getFolderTree()]);
  const u = (path: string, lastModified?: string) => ({ url: `${SITE.url}${path}`, lastModified: lastModified ? new Date(lastModified) : undefined });
  return [
    ...["/", "/news", "/media", "/viewer", "/info", "/timeline", "/collections", "/faq", "/about", "/contact", "/privacy"].map((p) => u(p)),
    ...categories.map((c) => u(`/media/${c.slug}`)),
    ...flattenTree(folders).map((f) => u(`/media/folder/${f.path.join("/")}`)),
    ...media.map((m) => u(`/media/${m.slug}`, m.dateAdded)),
    ...collections.map((c) => u(`/collections/${c.slug}`)),
    ...sections.map((s) => u(`/info/${s.slug}`)),
    ...entries.map((e) => u(`/info/${e.section}/${e.slug}`, e.lastReviewed)),
  ];
}
