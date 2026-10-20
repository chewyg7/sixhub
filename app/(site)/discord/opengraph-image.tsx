import { ogImage } from "@/lib/og";

export const alt = "The GTA 6 Hub Discord";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Discord", lede: "Thousands of fans talking GTA VI, Rockstar and everything else.", image: "/hero/bg-2000.webp" });
}
