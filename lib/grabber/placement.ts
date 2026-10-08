/**
 * Where an image from a GTAVice gallery belongs in the archive: its folder,
 * category, source and collection. Shared by the first-run seed and the
 * grabber so both file things the same way.
 */
import { INFO_ENTRIES } from "@/data/info";

export const CHARACTER_SLUGS = new Set(INFO_ENTRIES.filter((e) => e.section === "characters").map((e) => e.slug));
export const LOCATION_SLUGS = new Set(INFO_ENTRIES.filter((e) => e.section === "locations").map((e) => e.slug));

const CHARACTER_RULES: [string, RegExp][] = [
  ["jason-duval", /\bjason\b/],
  ["lucia-caminos", /\blucia\b/],
  ["cal-hampton", /\bcal-hampton\b|\bcal\b/],
  ["brian-heder", /\bbrian\b/],
  ["boobie-ike", /\bboobie\b/],
  ["dre-quan-priest", /\bdre-?quan\b|\bdrequan\b|\bpreist\b/],
  ["real-dimez", /\breal-dimez\b|\bdimez\b/],
  ["raul-bautista", /\braul\b/],
];
const LOCATION_RULES: [string, RegExp][] = [
  ["vice-city", /\bvice-city\b/],
  ["leonida-keys", /\bleonida-keys\b|\bkeys\b/],
  ["grassrivers", /\bgrassrivers\b/],
  ["port-gellhorn", /\bport-gellhorn\b|\bgellhorn\b/],
  ["ambrosia", /\bambrosia\b/],
  ["mount-kalaga", /\bmount-kalaga\b|\bkalaga\b/],
];

/** Characters and locations named in a file name. */
export function inferTags(fileOrSlug: string) {
  const s = fileOrSlug.toLowerCase().replace(/[_\s.]+/g, "-");
  return {
    characters: CHARACTER_RULES.filter(([, re]) => re.test(s)).map(([slug]) => slug),
    locations: LOCATION_RULES.filter(([, re]) => re.test(s)).map(([slug]) => slug),
  };
}

function subject(slug: string, characters: string[], locations: string[]) {
  const chars = characters.filter((c) => CHARACTER_SLUGS.has(c));
  if (chars.length === 2 && chars.includes("jason-duval") && chars.includes("lucia-caminos")) return { kind: "duo" as const, slug: "jason-and-lucia" };
  if (chars.length === 1) return { kind: "character" as const, slug: chars[0] };
  const locs = locations.filter((l) => LOCATION_SLUGS.has(l));
  if (!chars.length && locs.length === 1) return { kind: "location" as const, slug: locs[0] };
  if (slug.includes("kalaga")) return { kind: "location" as const, slug: "mount-kalaga" };
  return null;
}

export interface Placement {
  folder: string;
  category: string;
}

/** Known galleries, with what they contain. */
export const KNOWN_GALLERIES: Record<string, { collection: string; source: string; date?: string; category: string; folder: string }> = {
  "trailer-1-screencaps": { collection: "trailer-1", source: "trailer-1", date: "2023-12-04", category: "screengrabs", folder: "screengrabs/trailer-1" },
  "trailer-2-screencaps": { collection: "trailer-2", source: "trailer-2", date: "2025-05-06", category: "screengrabs", folder: "screengrabs/trailer-2" },
  "an-extended-look-screencaps": { collection: "extended-look", source: "extended-look", date: "2026-08-27", category: "screengrabs", folder: "screengrabs/extended-look" },
  "official-website-screengrabs": { collection: "website-screengrabs", source: "rockstar-website", category: "screengrabs", folder: "screengrabs/website" },
  "official-screenshots-may-6-2025": { collection: "screenshots-may-2025", source: "rockstar-website", date: "2025-05-06", category: "screenshots", folder: "screenshots" },
  "official-artwork-may-6-2025": { collection: "artwork-may-2025", source: "rockstar-website", date: "2025-05-06", category: "artwork", folder: "artwork/trailer-2" },
  "official-cover-art-reveal": { collection: "cover-art", source: "rockstar-website", date: "2026-06-18", category: "artwork", folder: "artwork/cover-art" },
  "official-pre-order-artwork": { collection: "pre-order-artwork", source: "rockstar-website", date: "2026-06-18", category: "artwork", folder: "artwork/pre-order" },
  "official-pre-order-screenshots": { collection: "pre-order-screenshots", source: "rockstar-website", date: "2026-06-18", category: "screenshots", folder: "screenshots/pre-order" },
  "official-previews-screenshots-and-artwork": { collection: "previews", source: "press", category: "screenshots", folder: "screenshots/previews" },
  "soundtrack-artwork": { collection: "soundtrack-artwork", source: "music", category: "artwork", folder: "artwork/soundtrack" },
  "official-merchandise": { collection: "merchandise", source: "rockstar-store", category: "promotional", folder: "promotional/merchandise" },
  "netflix-announcement-aug-6-2026": { collection: "netflix-announcement", source: "rockstar-newswire", date: "2026-08-06", category: "promotional", folder: "promotional/netflix" },
};

/** Folder and category for one image from a gallery. */
export function placeGvItem(gallery: string, slug: string, characters: string[], locations: string[], fallbackCategory = "screenshots"): Placement {
  const s = subject(slug, characters, locations);
  switch (gallery) {
    case "official-screenshots-may-6-2025":
      if (slug.endsWith("-poster")) {
        if (s?.kind === "character") return { folder: `artwork/characters/${s.slug}`, category: "artwork" };
        if (s?.kind === "location") return { folder: `artwork/locations/${s.slug}`, category: "artwork" };
        return { folder: "artwork", category: "artwork" };
      }
      if (s?.kind === "location") return { folder: `screenshots/locations/${s.slug}`, category: "screenshots" };
      if (s) return { folder: `screenshots/characters/${s.slug}`, category: "screenshots" };
      return { folder: "screenshots", category: "screenshots" };
    case "official-artwork-may-6-2025":
      if (slug.includes("official-website-screenshot")) return { folder: "screengrabs/website", category: "screengrabs" };
      if (/^gv-gta-vi-.+-artwork$/.test(slug)) return { folder: "artwork/landmarks", category: "artwork" };
      if (s?.kind === "character") return { folder: `artwork/characters/${s.slug}`, category: "artwork" };
      if (s?.kind === "location") return { folder: `artwork/locations/${s.slug}`, category: "artwork" };
      return { folder: "artwork/trailer-2", category: "artwork" };
    case "official-previews-screenshots-and-artwork":
      return { folder: "screenshots/previews", category: fallbackCategory };
    default: {
      const known = KNOWN_GALLERIES[gallery];
      return known ? { folder: known.folder, category: known.category } : { folder: "", category: fallbackCategory };
    }
  }
}

/** Best guess for a gallery we haven't seen before. */
export function guessNewGallery(slug: string, title: string): { parent: string; category: string } {
  const s = `${slug} ${title}`.toLowerCase();
  if (/screencap|screengrab|trailer|extended/.test(s)) return { parent: "screengrabs", category: "screengrabs" };
  if (/screenshot/.test(s)) return { parent: "screenshots", category: "screenshots" };
  if (/art|cover|poster|wallpaper|key/.test(s)) return { parent: "artwork", category: "artwork" };
  if (/logo/.test(s)) return { parent: "logos", category: "logos" };
  return { parent: "promotional", category: "promotional" };
}
