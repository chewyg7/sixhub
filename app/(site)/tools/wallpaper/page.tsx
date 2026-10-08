import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { WallpaperMaker, type WallpaperArt } from "@/features/wallpaper/wallpaper-maker";
import { getAllMedia } from "@/lib/content";
import { smallestVariant } from "@/lib/media/variants";

export const metadata: Metadata = {
  title: "Wallpaper Maker",
  description: "Turn official GTA VI artwork into a wallpaper for your phone, desktop or ultrawide monitor, framed your way and saved at full resolution.",
  alternates: { canonical: "/tools/wallpaper" },
};

const CATEGORIES = new Set(["artwork", "screenshots", "promotional"]);

export default async function WallpaperPage() {
  const all = await getAllMedia();
  const toArt = (m: (typeof all)[number]): WallpaperArt => ({
    slug: m.slug,
    title: m.title,
    category: m.category,
    width: m.width!,
    height: m.height!,
    thumb: smallestVariant(m, 480)?.url ?? m.original.url,
    preview: smallestVariant(m, 1920)?.url ?? m.original.url,
    full: m.original.url,
    color: m.dominantColor ?? null,
  });
  // Backgrounds: large, opaque stills (transparent logos and small images make poor wallpapers).
  const art = all.filter((m) => m.kind === "image" && CATEGORIES.has(m.category) && !m.original.hasAlpha && (m.width ?? 0) >= 1600 && (m.height ?? 0) >= 900).map(toArt);
  // Cut-outs (transparent PNG/WebP: logos, cover-art pieces, characters) make the best overlays.
  const cutouts = all.filter((m) => m.kind === "image" && m.original.hasAlpha && (m.width ?? 0) >= 200).map(toArt);

  return (
    <Container wide>
      <PageHeader
        crumbs={[{ href: "/tools", label: "Tools" }, { label: "Wallpaper Maker" }]}
        title="Wallpaper Maker"
        lede="Pick a screen size and a piece of official art, drag to frame it, layer anything on top, and save it at full resolution."
      />
      <WallpaperMaker art={art} cutouts={cutouts} />
    </Container>
  );
}
