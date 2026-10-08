import type { ISODate, Verification } from "@/types/content";

export interface MediaRecord {
  slug: string;
  title: string;
  category: string;
  description: string;
  alt: string;
  datePublished: ISODate;
  dateAdded: ISODate;
  source: string;
  officialUrl?: string;
  tags: string[];
  characters: string[];
  locations: string[];
  downloadable: boolean;
  credit?: string;
  verification: Verification;
}

const VI = "https://www.rockstargames.com/VI";

/**
 * Editorial records for the official trailers. Technical metadata, posters
 * and storyboards come from data/generated/trailers.json
 * (scripts/import-trailers.mjs); the video files stream from their hosts.
 */
export const TRAILER_RECORDS: MediaRecord[] = [
  {
    slug: "gta-vi-trailer-1",
    title: "Trailer 1",
    category: "videos",
    description: "The first official trailer for Grand Theft Auto VI, introducing Lucia and the state of Leonida. 4K, 30 fps.",
    alt: "Grand Theft Auto VI Trailer 1: an aerial shot over a crowded Vice City beach.",
    datePublished: "2023-12-04",
    dateAdded: "2026-10-02T06:00:00Z",
    source: "trailer-1",
    officialUrl: VI,
    tags: ["trailer", "4K", "30 fps"],
    characters: ["lucia-caminos", "jason-duval"],
    locations: ["vice-city", "leonida-keys", "grassrivers"],
    downloadable: false,
    credit: "Rockstar Games",
    verification: "official",
  },
  {
    slug: "gta-vi-trailer-2",
    title: "Trailer 2",
    category: "videos",
    description: "The second official trailer for Grand Theft Auto VI, following Jason and Lucia across Leonida. 4K, 30 fps.",
    alt: "Grand Theft Auto VI Trailer 2: Jason in the driver's seat at sunset, Lucia beside him.",
    datePublished: "2025-05-06",
    dateAdded: "2026-10-02T06:00:00Z",
    source: "trailer-2",
    officialUrl: VI,
    tags: ["trailer", "4K", "30 fps"],
    characters: ["jason-duval", "lucia-caminos", "cal-hampton", "boobie-ike", "dre-quan-priest", "real-dimez", "raul-bautista", "brian-heder"],
    locations: ["vice-city", "leonida-keys", "grassrivers", "port-gellhorn", "ambrosia", "mount-kalaga"],
    downloadable: false,
    credit: "Rockstar Games",
    verification: "official",
  },
  {
    slug: "gta-vi-extended-look",
    title: "An Extended Look",
    category: "videos",
    description: "An extended presentation of Grand Theft Auto VI captured in-game on PS5. 4K, 30 fps, 26 minutes.",
    alt: "Grand Theft Auto VI: An Extended Look, a sunlit view over the Vice City skyline.",
    datePublished: "2026-08-27",
    dateAdded: "2026-10-02T06:00:00Z",
    source: "extended-look",
    officialUrl: VI,
    tags: ["gameplay", "4K", "30 fps", "captured on PS5"],
    characters: ["jason-duval", "lucia-caminos"],
    locations: ["vice-city"],
    downloadable: false,
    credit: "Rockstar Games",
    verification: "official",
  },
];
