import { ogImage } from "@/lib/og";
import { fetchRockstarIntel } from "@/lib/news/rockstarintel";

export const alt = "GTA 6 news on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  // The newest story's picture, when the feed is reachable.
  const latest = await fetchRockstarIntel()
    .then((p) => p.articles.find((a) => a.image)?.image?.url)
    .catch(() => undefined);
  return ogImage({ title: "News", lede: "The latest Grand Theft Auto VI news, updated around the clock.", image: latest ?? "/hero/bg-2000.webp" });
}
