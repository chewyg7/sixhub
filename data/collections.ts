import type { Collection } from "@/types/content";

const VI = { label: "Rockstar Games — Grand Theft Auto VI", url: "https://www.rockstargames.com/VI" };

/**
 * Collections group media by release or theme. Descriptions of real
 * releases are factual; the media inside them is the development sample
 * set until official files are ingested.
 */
export const COLLECTIONS: Collection[] = [
  {
    slug: "trailer-2",
    title: "Trailer 2",
    kind: "release",
    date: "2025-05-06",
    description: "Grand Theft Auto VI's second trailer, published by Rockstar Games on May 6, 2025, together with frames taken from it.",
    coverSlug: "tf2-keys-sunrise",
    mediaSlugs: ["video-trailer-2-sample", "tf2-keys-sunrise", "tf2-highway-night"],
    sources: [VI],
    timelineEventId: "2025-05-06-trailer-2",
  },
  {
    slug: "screenshots-may-2025",
    title: "Screenshot Release — May 2025",
    kind: "release",
    date: "2025-05-06",
    description: "Screenshots published on the official Grand Theft Auto VI website alongside Trailer 2 and the character and location profiles.",
    coverSlug: "ss-ocean-drive-dusk",
    mediaSlugs: [
      "ss-ocean-drive-dusk",
      "ss-downtown-night",
      "ss-causeway-golden",
      "ss-keys-shallows",
      "ss-keys-marina-noon",
      "ss-grassrivers-mist",
      "ss-grassrivers-airboat-dusk",
      "ss-kalaga-ridgeline",
      "ss-kalaga-overcast",
      "ss-port-gellhorn-docks",
      "ss-ambrosia-refinery",
      "ss-beachfront-daylight",
      "ss-skyline-storm",
      "ss-motel-strip-night",
    ],
    sources: [VI],
    timelineEventId: "2025-05-06-website",
  },
  {
    slug: "trailer-1",
    title: "Trailer 1",
    kind: "release",
    date: "2023-12-04",
    description: "Grand Theft Auto VI's first trailer, published by Rockstar Games on December 4, 2023, together with frames taken from it.",
    coverSlug: "tf1-opening-coast",
    mediaSlugs: ["video-trailer-1-sample", "tf1-opening-coast", "tf1-city-lights"],
    sources: [VI],
    timelineEventId: "2023-12-04-trailer-1",
  },
  {
    slug: "character-artwork",
    title: "Character Artwork",
    kind: "curated",
    description: "Portrait artwork of the game's characters.",
    coverSlug: "art-character-lucia-portrait",
    mediaSlugs: ["art-character-lucia-portrait", "art-character-jason-portrait", "art-poster-portrait"],
    sources: [],
  },
  {
    slug: "promotional-artwork",
    title: "Promotional Artwork",
    kind: "curated",
    description: "Key art, panoramas, banners and social assets used across the campaign.",
    coverSlug: "art-key-art-landscape",
    mediaSlugs: ["art-key-art-landscape", "art-vice-city-panorama", "promo-billboard", "promo-banner-ultrawide", "promo-social-square", "promo-social-portrait"],
    sources: [],
  },
  {
    slug: "branding",
    title: "Logos & Branding",
    kind: "curated",
    description: "Logos and marks, provided as transparent originals where available.",
    coverSlug: "logo-monogram",
    mediaSlugs: ["logo-monogram", "logo-wordmark-light", "logo-wordmark-dark"],
    sources: [],
  },
  {
    slug: "audio",
    title: "Audio",
    kind: "curated",
    description: "Music and audio releases.",
    coverSlug: "audio-theme-sample",
    mediaSlugs: ["audio-theme-sample", "audio-radio-sample", "audio-ambience-sample"],
    sources: [],
  },
];
