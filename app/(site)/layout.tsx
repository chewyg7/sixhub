import { SiteHeader, type MenuPreview } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Announcement } from "@/components/layout/announcement";
import { Maintenance } from "@/components/layout/maintenance";
import { getMediaBySlugs, getSettings } from "@/lib/content";
import { smallestVariant } from "@/lib/media/variants";

/** Artwork shown behind each destination in the full-screen menu. */
const MENU_ART: Record<string, string> = {
  home: "gv-jason-and-lucia-01-landscape",
  news: "gv-jason-and-lucia-motel-landscape",
  media: "gv-gta-6-official-cover-art-landscape",
  viewer: "gv-jason-and-lucia-robbery-landscape",
  characters: "gv-lucia-caminos-01",
  locations: "gv-vice-city-hi-res-artwork",
  timeline: "gv-leonida-keys-hi-res-artwork",
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const keys = Object.keys(MENU_ART);
  const [items, settings] = await Promise.all([getMediaBySlugs(keys.map((k) => MENU_ART[k])), getSettings()]);
  const previews: Record<string, MenuPreview> = {};
  for (const k of keys) {
    const m = items.find((i) => i.slug === MENU_ART[k]);
    if (m) previews[k] = { src: smallestVariant(m, 1920)?.url ?? m.original.url, color: m.dominantColor ?? null };
  }
  return (
    <>
      <SiteHeader previews={previews} nav={settings.site.nav} menu={settings.site.menu} />
      <Announcement />
      <main id="main" className="min-h-[70vh] pt-24 sm:pt-28">
        {children}
      </main>
      <Footer />
      {settings.maintenance.enabled && <Maintenance title={settings.maintenance.title} message={settings.maintenance.message} />}
    </>
  );
}
