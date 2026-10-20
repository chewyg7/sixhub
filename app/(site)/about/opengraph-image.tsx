import { ogImage } from "@/lib/og";

export const alt = "About GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "About", lede: "Who runs GTA 6 Hub, and how the archive is put together.", image: "/hero/bg-2000.webp" });
}
