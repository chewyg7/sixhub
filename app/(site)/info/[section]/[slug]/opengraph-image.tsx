import { mediaPicture, ogImage } from "@/lib/og";
import { getInfoEntry, getInfoSections, getMediaBySlug } from "@/lib/content";

export const alt = "GTA 6 information on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params;
  const [entry, sections] = await Promise.all([getInfoEntry(section, slug), getInfoSections()]);
  if (!entry) return ogImage({ title: "Information", image: "/hero/bg-2000.webp" });
  const image = entry.imageSlug ? await getMediaBySlug(entry.imageSlug) : null;
  return ogImage({
    kicker: sections.find((s) => s.slug === section)?.title ?? "Information",
    title: entry.name,
    lede: entry.summary,
    image: mediaPicture(image) ?? "/hero/bg-2000.webp",
  });
}
