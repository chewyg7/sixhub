import { mediaPicture, ogImage } from "@/lib/og";
import { getNewestPublished } from "@/lib/content";

export const alt = "GTA 6 media archive on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const [art] = await getNewestPublished((m) => m.kind === "image" && m.category === "artwork" && !m.original.hasAlpha);
  return ogImage({
    title: "Media Archive",
    lede: "Every official GTA VI screenshot, artwork, trailer, logo and font, in full resolution.",
    image: mediaPicture(art) ?? "/hero/bg-2000.webp",
  });
}
