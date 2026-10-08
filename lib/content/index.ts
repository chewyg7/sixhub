import "server-only";
import { cache } from "react";
import type { MediaFolder, MediaItem } from "@/types/content";
import { snapshot } from "./db-source";
import { byNewest, type LabelLookups } from "./relations";

/**
 * Read API for pages and components. Everything comes from the database via
 * a cached snapshot (see db-source.ts); hidden media is already excluded.
 */
const snap = cache(() => snapshot());

export const getAllMedia = cache(async () => snap().media);
export const getMediaBySlug = cache(async (slug: string) => snap().bySlug.get(slug) ?? null);
export const getCollections = cache(async () => snap().collections);
export const getCollection = cache(async (slug: string) => snap().collections.find((c) => c.slug === slug) ?? null);
export const getInfoSections = cache(async () => [...snap().sections].sort((a, b) => a.order - b.order));
export const getInfoEntries = cache(async (section?: string) => (section ? snap().entries.filter((e) => e.section === section) : snap().entries));
export const getInfoEntry = cache(async (section: string, slug: string) => snap().entries.find((e) => e.section === section && e.slug === slug) ?? null);
export const getTimeline = cache(async () => [...snap().timeline].sort((a, b) => a.date.localeCompare(b.date)));
export const getCategories = cache(async () => [...snap().categories].sort((a, b) => a.order - b.order));
export const getSources = cache(async () => snap().sources);
export const getSettings = cache(async () => snap().settings);
export const getFaq = cache(async () => snap().faq.filter((f) => f.published).sort((a, b) => a.sort - b.sort));

export async function getMediaByCategory(category: string): Promise<MediaItem[]> {
  return (await getAllMedia()).filter((m) => m.category === category);
}

export async function getMediaBySlugs(slugs: string[]): Promise<MediaItem[]> {
  const map = snap().bySlug;
  return slugs.map((s) => map.get(s)).filter((m): m is MediaItem => Boolean(m));
}

export async function getLatestMedia(limit = 12): Promise<MediaItem[]> {
  return [...(await getAllMedia())].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, limit);
}

export async function getNewestPublished(filter: (m: MediaItem) => boolean, limit = 1): Promise<MediaItem[]> {
  return (await getAllMedia()).filter(filter).sort(byNewest).slice(0, limit);
}

/** Lookups for resolving slugs to display names. */
export const getLabelLookups = cache(async (): Promise<LabelLookups> => {
  const s = snap();
  return {
    characters: Object.fromEntries(s.entries.filter((e) => e.section === "characters").map((e) => [e.slug, e.name])),
    locations: Object.fromEntries(s.entries.filter((e) => e.section === "locations").map((e) => [e.slug, e.name])),
    collections: Object.fromEntries(s.collections.map((c) => [c.slug, c.title])),
    categories: Object.fromEntries(s.categories.map((c) => [c.slug, c.singular])),
  };
});

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

export interface FolderNode extends MediaFolder {
  /** Slug chain from the top level, e.g. ["artwork", "characters", "lucia-caminos"]. */
  path: string[];
  children: FolderNode[];
  /** Items filed directly in this folder. */
  direct: number;
  /** Items in this folder and every folder below it. */
  total: number;
  /** Cover image: the folder's chosen cover, else the newest item inside it. */
  cover?: MediaItem;
}

/** The folder tree with counts and covers. Empty folders are pruned unless `keepEmpty`. */
export const getFolderTree = cache(async (keepEmpty = false): Promise<FolderNode[]> => {
  const s = snap();
  const byFolder = new Map<string, MediaItem[]>();
  for (const m of s.media) byFolder.set(m.folderId ?? "", [...(byFolder.get(m.folderId ?? "") ?? []), m]);

  const build = (parentId: string | null, parentPath: string[]): FolderNode[] =>
    s.folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((f) => {
        const path = [...parentPath, f.slug];
        const children = build(f.id, path);
        const own = byFolder.get(f.id) ?? [];
        const total = own.length + children.reduce((n, c) => n + c.total, 0);
        const newest = [...own].sort(byNewest)[0] ?? children.find((c) => c.cover)?.cover;
        const cover = (f.coverSlug && s.bySlug.get(f.coverSlug)) || newest;
        return { ...f, path, children, direct: own.length, total, cover };
      })
      .filter((n) => keepEmpty || n.total > 0);
  return build(null, []);
});

export function flattenTree(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** Resolves a slug path to a folder, with its ancestors for breadcrumbs. */
export async function getFolderByPath(path: string[]): Promise<{ folder: FolderNode; trail: FolderNode[] } | null> {
  let level = await getFolderTree();
  const trail: FolderNode[] = [];
  for (const slug of path) {
    const next = level.find((f) => f.slug === slug);
    if (!next) return null;
    trail.push(next);
    level = next.children;
  }
  const folder = trail.at(-1);
  return folder ? { folder, trail } : null;
}

/** Media filed in a folder, optionally including everything below it. */
export async function getFolderMedia(folder: FolderNode, deep: boolean): Promise<MediaItem[]> {
  const ids = new Set(deep ? flattenTree([folder]).map((f) => f.id) : [folder.id]);
  return (await getAllMedia()).filter((m) => ids.has(m.folderId ?? ""));
}

/** URL path of a folder by id (for links from media pages). */
export async function folderHref(id: string | undefined): Promise<{ href: string; name: string; trail: { name: string; href: string }[] } | null> {
  if (!id) return null;
  const all = flattenTree(await getFolderTree(true));
  const f = all.find((x) => x.id === id);
  if (!f) return null;
  const trail = f.path.map((_, i) => {
    const node = all.find((x) => x.path.length === i + 1 && x.path.every((p, j) => p === f.path[j]))!;
    return { name: node.name, href: `/media/folder/${f.path.slice(0, i + 1).join("/")}` };
  });
  return { href: `/media/folder/${f.path.join("/")}`, name: f.name, trail };
}

/** Folder cards: name, link, counts and three previews from inside the folder. */
export async function toFolderCards(nodes: FolderNode[]) {
  const all = await getAllMedia();
  return nodes.map((n) => {
    const ids = new Set(flattenTree([n]).map((f) => f.id));
    const inside = all.filter((m) => ids.has(m.folderId ?? "")).sort(byNewest);
    const previews = [n.cover, ...inside.filter((m) => m.slug !== n.cover?.slug)].filter((m): m is MediaItem => Boolean(m)).slice(0, 3);
    return { id: n.id, name: n.name, href: `/media/folder/${n.path.join("/")}`, total: n.total, folders: n.children.length, previews };
  });
}
