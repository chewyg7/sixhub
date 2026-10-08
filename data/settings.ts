import type { SiteSettings } from "@/types/content";

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
};
