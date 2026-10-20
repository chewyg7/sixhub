import { ogImage } from "@/lib/og";

export const alt = "GTA 6 Hub privacy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Privacy", lede: "What GTA 6 Hub keeps, and what it never does.", image: "/hero/bg-2000.webp" });
}
