import { mediaPicture, ogImage } from "@/lib/og";
import { getCollections, getMediaBySlug } from "@/lib/content";

export const alt = "GTA 6 media collections on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const [first] = await getCollections();
  const cover = first ? await getMediaBySlug(first.coverSlug) : null;
  return ogImage({
    title: "Collections",
    lede: "GTA VI media grouped by release: trailers, screenshot drops and artwork sets.",
    image: mediaPicture(cover) ?? "/hero/bg-2000.webp",
  });
}
