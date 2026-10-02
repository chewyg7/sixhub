import type { MediaCategory, MediaCategorySlug } from "@/types/content";

/**
 * Media categories. Adding a category here (and to `MediaCategorySlug`)
 * is all that's needed for it to appear in navigation, filters, the
 * archive routes (`/media/<slug>`) and the Media Viewer browser.
 */
export const MEDIA_CATEGORIES: MediaCategory[] = [
  { slug: "screenshots", label: "Screenshots", singular: "Screenshot", order: 1, description: "Official in-game screenshots and frames taken from trailers." },
  { slug: "artwork", label: "Official Artwork", singular: "Artwork", order: 2, description: "Key art, character art and illustrated promotional pieces." },
  { slug: "videos", label: "Videos", singular: "Video", order: 3, description: "Trailers and other official video releases." },
  { slug: "audio", label: "Audio", singular: "Audio", order: 4, description: "Music, soundtrack releases and other official audio." },
  { slug: "logos", label: "Logos & Branding", singular: "Logo", order: 5, description: "Logos, wordmarks and brand marks." },
  { slug: "promotional", label: "Promotional Material", singular: "Promotional asset", order: 6, description: "Social assets, banners, billboards and campaign material." },
];

export const CATEGORY_BY_SLUG = Object.fromEntries(MEDIA_CATEGORIES.map((c) => [c.slug, c])) as Record<MediaCategorySlug, MediaCategory>;

export function isCategorySlug(value: string): value is MediaCategorySlug {
  return value in CATEGORY_BY_SLUG;
}
