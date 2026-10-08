import type { HomeSection, SiteSettings } from "@/types/content";

/** Home sections in their default order. Sections without a heading ignore kicker/title. */
export const DEFAULT_SECTIONS: HomeSection[] = [
  { id: "news", enabled: true, kicker: "RockstarINTEL", title: "Latest news" },
  { id: "cast", enabled: true, kicker: "The cast", title: "Meet the people" },
  { id: "regions", enabled: true, kicker: "Leonida", title: "Explore the state" },
  { id: "trailers", enabled: true, kicker: "Official trailers", title: "Watch it again" },
  { id: "gallery", enabled: true, kicker: "", title: "" },
  { id: "viewer", enabled: true, kicker: "", title: "" },
  { id: "timeline", enabled: true, kicker: "Milestones", title: "The road to release" },
  { id: "faq", enabled: true, kicker: "Questions", title: "Good to know" },
  { id: "marquee", enabled: true, kicker: "", title: "" },
];

/** Which home sections have a heading the site editor can change. */
export const SECTION_META: Record<HomeSection["id"], { label: string; heading: boolean }> = {
  news: { label: "Latest news", heading: true },
  cast: { label: "Characters", heading: true },
  regions: { label: "Locations", heading: true },
  trailers: { label: "Trailers", heading: true },
  gallery: { label: "Gallery wall", heading: false },
  viewer: { label: "Media Viewer promo", heading: false },
  timeline: { label: "Timeline", heading: true },
  faq: { label: "FAQ teaser", heading: true },
  marquee: { label: "Scrolling band", heading: false },
};

/** Settings the database starts with; owners change them in the admin panel. */
export const DEFAULT_SETTINGS: SiteSettings = {
  release: { date: "2026-11-19", platforms: ["PlayStation 5", "Xbox Series X|S"] },
  launchMode: "auto",
  socials: {
    discord: "https://discord.gg/gtavc",
    x: "https://x.com/gtasixinfo",
    instagram: "https://www.instagram.com/gtasixhub",
  },
  announcement: { enabled: false, text: "", href: "" },
  home: {
    playSlug: "gta-vi-trailer-2",
    galleryCollection: "screenshots-may-2025",
    viewerStill: "gv-gta-vi-trailer-2-0244",
    viewerPicks: ["gta-vi-trailer-2", "gv-gta-vi-trailer-1-0057", "gv-vice-city-hi-res-artwork", "gv-jason-and-lucia-motel-landscape"],
  },
  site: {
    title: "GTA 6 Hub — GTA VI news, media archive & Media Viewer",
    description: "News, a searchable archive of official GTA VI media, and a built-in Media Viewer for analyzing trailers, screenshots, artwork and audio.",
    sections: DEFAULT_SECTIONS,
    marquee: ["Coming", "{date}"],
    nav: [
      { label: "News", href: "/news" },
      { label: "Media", href: "/media" },
      { label: "Viewer", href: "/viewer" },
      { label: "Info", href: "/info" },
      { label: "Timeline", href: "/timeline" },
      { label: "Tools", href: "/tools" },
    ],
    menu: [
      { label: "Home", href: "/" },
      { label: "News", href: "/news" },
      { label: "Media", href: "/media" },
      { label: "Media Viewer", href: "/viewer" },
      { label: "Characters", href: "/info/characters" },
      { label: "Leonida", href: "/info/locations" },
      { label: "Timeline", href: "/timeline" },
    ],
    footer: {
      headline: "See you in Leonida",
      tagline: "Every GTA VI screenshot, trailer and headline in one place, and the tools to study them.",
      ctaLabel: "Explore the archive",
      ctaHref: "/media",
    },
  },
  maintenance: { enabled: false, title: "Back soon", message: "We’re making some changes. Check back in a few minutes." },
};
