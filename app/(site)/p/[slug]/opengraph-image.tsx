import { ogImage } from "@/lib/og";
import { getPage } from "@/lib/db/extras";

export const alt = "A page on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const page = getPage((await params).slug);
  return ogImage({ title: page?.title ?? "GTA 6 Hub", lede: page?.description || undefined, image: "/hero/bg-2000.webp" });
}
