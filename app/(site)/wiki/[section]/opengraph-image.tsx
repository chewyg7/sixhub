import { mediaPicture, ogImage } from "@/lib/og";
import { getInfoEntries, getInfoSections, getMediaBySlug } from "@/lib/content";
import { imageUrl, isViFile, sectionMembers, wikiSection } from "@/lib/wiki/api";

export const alt = "GTA 6 information on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = (await getInfoSections()).find((x) => x.slug === section);
  const wiki = wikiSection(section);
  let image: string | undefined;
  if (wiki) {
    const cover = (await sectionMembers(section)).find((m) => m.image && isViFile(m.image));
    image = cover?.image ? imageUrl(cover.image, 1280) : undefined;
  } else {
    const withImage = (await getInfoEntries(section)).find((e) => e.imageSlug);
    image = mediaPicture(withImage?.imageSlug ? await getMediaBySlug(withImage.imageSlug) : null);
  }
  return ogImage({ kicker: "Wiki", title: s?.title ?? wiki?.title ?? "Wiki", lede: s?.description ?? wiki?.description, image: image ?? "/hero/bg-2000.webp" });
}
