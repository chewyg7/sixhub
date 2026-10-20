import { mediaPicture, ogImage } from "@/lib/og";
import { getCollection, getMediaBySlug } from "@/lib/content";

export const alt = "A GTA 6 media collection on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCollection((await params).slug);
  if (!c) return ogImage({ title: "Collections", image: "/hero/bg-2000.webp" });
  const cover = await getMediaBySlug(c.coverSlug);
  return ogImage({ kicker: "Collection", title: c.title, lede: c.description, image: mediaPicture(cover) ?? "/hero/bg-2000.webp" });
}
