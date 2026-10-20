import { ogImage } from "@/lib/og";

export const alt = "GTA 6 fan tools on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Tools", lede: "Free GTA VI fan tools: a plate creator, a VI text generator and a wallpaper maker.", image: "/tools/plate/preview.webp" });
}
