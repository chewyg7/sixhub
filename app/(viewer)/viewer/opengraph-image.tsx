import { mediaPicture, ogImage } from "@/lib/og";
import { getNewestPublished } from "@/lib/content";

export const alt = "The GTA 6 Hub Media Viewer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const [trailer] = await getNewestPublished((m) => m.kind === "video" && Boolean(m.poster));
  return ogImage({
    title: "Media Viewer",
    lede: "Study GTA VI trailers and screenshots frame by frame: pixel zoom, crop, capture and compare.",
    image: mediaPicture(trailer) ?? "/hero/bg-2000.webp",
  });
}
