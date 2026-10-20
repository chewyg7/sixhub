import { mediaPicture, ogImage } from "@/lib/og";
import { getNewestPublished } from "@/lib/content";

export const alt = "The GTA 6 timeline on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const [still] = await getNewestPublished((m) => m.kind === "image" && m.category === "screenshots" && !m.original.hasAlpha);
  return ogImage({
    title: "Timeline",
    lede: "Every official GTA VI milestone: announcements, trailers, screenshot drops and release dates.",
    image: mediaPicture(still) ?? "/hero/bg-2000.webp",
  });
}
