import { ogImage } from "@/lib/og";

export const alt = "GTA 6 FAQ on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "FAQ", lede: "The GTA VI release, launch times around the world, and GTA 6 Hub.", image: "/hero/bg-2000.webp" });
}
