import type { MediaItem } from "@/types/content";

/** `srcset` from pre-generated display variants (never the original). */
export function srcSetFor(item: Pick<MediaItem, "variants">) {
  return [...item.variants]
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");
}

/** Smallest variant at least `minWidth` wide, or the largest available. */
export function smallestVariant(item: Pick<MediaItem, "variants">, minWidth = 0) {
  const sorted = [...item.variants].sort((a, b) => a.width - b.width);
  return sorted.find((v) => v.width >= minWidth) ?? sorted[sorted.length - 1];
}

export function largestVariant(item: Pick<MediaItem, "variants">) {
  return [...item.variants].sort((a, b) => b.width - a.width)[0];
}
