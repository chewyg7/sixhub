/**
 * The relationship engine. Pure functions over content arrays so they can
 * run on the server (pages) and in the browser (lightbox, viewer).
 */
import type { MediaItem, TagRef } from "@/types/content";

export interface LabelLookups {
  characters: Record<string, string>;
  locations: Record<string, string>;
  collections: Record<string, string>;
  /** Category slug → singular label. */
  categories: Record<string, string>;
}

export const byNewest = (a: MediaItem, b: MediaItem) => b.datePublished.localeCompare(a.datePublished) || b.dateAdded.localeCompare(a.dateAdded);

const KIND_LABEL = { image: "Image", video: "Video", audio: "Audio", font: "Font" } as const;

export function mediaTags(item: MediaItem, labels: LabelLookups): TagRef[] {
  return [
    ...item.characters.map((v) => ({ type: "character" as const, value: v, label: labels.characters[v] ?? v })),
    ...item.locations.map((v) => ({ type: "location" as const, value: v, label: labels.locations[v] ?? v })),
    { type: "source", value: item.source.slug, label: item.source.label },
    ...item.collections.map((v) => ({ type: "collection" as const, value: v, label: labels.collections[v] ?? v })),
    { type: "category", value: item.category, label: labels.categories[item.category] ?? item.category },
    { type: "kind", value: item.kind, label: KIND_LABEL[item.kind] },
    ...item.tags.map((v) => ({ type: "tag" as const, value: v, label: v })),
  ];
}

/**
 * Every tag resolves to a page listing everything related to it:
 * characters and locations to their database entries, collections to
 * the collection page, everything else to a filtered archive view.
 */
export function tagHref(tag: TagRef): string {
  switch (tag.type) {
    case "character":
      return `/info/characters/${tag.value}`;
    case "location":
      return `/info/locations/${tag.value}`;
    case "collection":
      return `/collections/${tag.value}`;
    case "source":
      return `/media?source=${encodeURIComponent(tag.value)}`;
    case "category":
      return `/media/${tag.value}`;
    case "kind":
      return `/media?type=${tag.value}`;
    default:
      return `/media?tag=${encodeURIComponent(tag.value)}`;
  }
}

export const TAG_TYPE_LABEL: Record<TagRef["type"], string> = {
  character: "Character",
  location: "Location",
  source: "Source",
  collection: "Collection",
  category: "Category",
  kind: "Type",
  tag: "Tag",
};

/** Score-based related media: shared characters/locations/collections weigh most. */
export function relatedMedia(item: MediaItem, all: MediaItem[], limit = 8): MediaItem[] {
  const scored: { m: MediaItem; score: number }[] = [];
  for (const m of all) {
    if (m.slug === item.slug) continue;
    let score = 0;
    for (const c of m.characters) if (item.characters.includes(c)) score += 4;
    for (const l of m.locations) if (item.locations.includes(l)) score += 3;
    for (const c of m.collections) if (item.collections.includes(c)) score += 3;
    if (m.source.slug === item.source.slug) score += 1;
    if (m.category === item.category) score += 1;
    for (const t of m.tags) if (item.tags.includes(t)) score += 1;
    if (score > 0) scored.push({ m, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || byNewest(a.m, b.m))
    .slice(0, limit)
    .map((s) => s.m);
}

export function mediaForCharacter(all: MediaItem[], slug: string) {
  return all.filter((m) => m.characters.includes(slug)).sort(byNewest);
}

export function mediaForLocation(all: MediaItem[], slug: string) {
  return all.filter((m) => m.locations.includes(slug)).sort(byNewest);
}

/** Pick the best display variant for a target CSS width at a given DPR. */
export function pickVariant(item: Pick<MediaItem, "variants">, cssWidth: number, dpr = 2) {
  const target = cssWidth * dpr;
  const sorted = [...item.variants].sort((a, b) => a.width - b.width);
  return sorted.find((v) => v.width >= target) ?? sorted[sorted.length - 1];
}
