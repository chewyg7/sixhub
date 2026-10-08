import type { MediaCategory } from "@/types/content";

/**
 * Categories the database starts with. After the first run, owners manage
 * categories in the admin panel; read them with getCategories().
 */
export const DEFAULT_CATEGORIES: MediaCategory[] = [
  { slug: "screenshots", label: "Screenshots", singular: "Screenshot", order: 1, description: "Official in-game screenshots released by Rockstar Games." },
  { slug: "screengrabs", label: "Screengrabs", singular: "Screengrab", order: 2, description: "Frames captured from the official trailers and the Rockstar website." },
  { slug: "artwork", label: "Official Artwork", singular: "Artwork", order: 3, description: "Key art, character art, posters and illustrated pieces." },
  { slug: "videos", label: "Videos", singular: "Video", order: 4, description: "Official trailers and gameplay presentations." },
  { slug: "logos", label: "Logos", singular: "Logo", order: 5, description: "Official logos and marks." },
  { slug: "fonts", label: "Fonts", singular: "Font", order: 6, description: "Typefaces in the Grand Theft Auto VI style." },
  { slug: "promotional", label: "Promotional", singular: "Promotional asset", order: 7, description: "Merchandise, partnerships and campaign material." },
];
