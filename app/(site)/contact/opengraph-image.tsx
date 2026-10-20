import { ogImage } from "@/lib/og";

export const alt = "Contact GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Contact", lede: "Corrections, takedowns, partnerships and everything else.", image: "/hero/bg-2000.webp" });
}
