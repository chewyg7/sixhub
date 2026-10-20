import { ogImage } from "@/lib/og";

export const alt = "The GTA 6 Hub team";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Team", lede: "Meet the people behind GTA 6 Hub.", image: "/hero/bg-2000.webp" });
}
