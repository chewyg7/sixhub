import { mediaPicture, ogImage } from "@/lib/og";
import { getInfoEntries, getMediaBySlug } from "@/lib/content";

export const alt = "GTA 6 information on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const withImage = (await getInfoEntries("characters")).find((e) => e.imageSlug);
  const image = withImage?.imageSlug ? await getMediaBySlug(withImage.imageSlug) : null;
  return ogImage({
    title: "Information",
    lede: "The characters, places, trailers and release details of GTA VI, linked to the media they appear in.",
    image: mediaPicture(image) ?? "/hero/bg-2000.webp",
  });
}
