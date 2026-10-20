import { mediaPicture, ogImage } from "@/lib/og";
import { getInfoEntries, getInfoSections, getMediaBySlug } from "@/lib/content";

export const alt = "GTA 6 information on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = (await getInfoSections()).find((x) => x.slug === section);
  const withImage = (await getInfoEntries(section)).find((e) => e.imageSlug);
  const image = withImage?.imageSlug ? await getMediaBySlug(withImage.imageSlug) : null;
  return ogImage({ kicker: "Information", title: s?.title ?? "Information", lede: s?.description, image: mediaPicture(image) ?? "/hero/bg-2000.webp" });
}
