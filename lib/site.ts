export const SITE = {
  name: "GTA 6 Hub",
  domain: "gtasixhub.com",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://gtasixhub.com",
  description: "News, a searchable archive of official GTA VI media, and a built-in Media Viewer for analyzing trailers, screenshots, artwork and audio.",
  contactEmail: "contact@gtasixhub.com",
  newsSource: { name: "RockstarINTEL", url: "https://rockstarintel.com" },
} as const;

export interface NavItem {
  href: string;
  label: string;
  /** Match nested routes as active. */
  match?: string[];
  children?: { href: string; label: string; description?: string }[];
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/news", label: "News" },
  {
    href: "/media",
    label: "Media",
    match: ["/media", "/collections"],
    children: [
      { href: "/media", label: "All media" },
      { href: "/media/screenshots", label: "Screenshots" },
      { href: "/media/artwork", label: "Official Artwork" },
      { href: "/media/videos", label: "Videos" },
      { href: "/media/audio", label: "Audio" },
      { href: "/media/logos", label: "Logos & Branding" },
      { href: "/media/promotional", label: "Promotional" },
      { href: "/collections", label: "Collections" },
    ],
  },
  { href: "/viewer", label: "Media Viewer" },
  {
    href: "/info",
    label: "Information",
    match: ["/info", "/timeline"],
    children: [
      { href: "/info", label: "Database" },
      { href: "/info/characters", label: "Characters" },
      { href: "/info/locations", label: "Locations" },
      { href: "/info/trailers", label: "Trailers" },
      { href: "/info/release", label: "Release information" },
      { href: "/timeline", label: "Timeline" },
    ],
  },
];

/** Official release (Rockstar Newswire, Nov 6 2025). Countdown targets local midnight. */
export const RELEASE = {
  date: "2026-11-19",
  label: "November 19, 2026",
  platforms: ["PlayStation 5", "Xbox Series X|S"],
} as const;
