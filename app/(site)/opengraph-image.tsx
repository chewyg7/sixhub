import { ogImage } from "@/lib/og";
import { SITE } from "@/lib/site";

export const alt = "GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    title: SITE.name,
    lede: "GTA VI news, every official screenshot, trailer and artwork, and a viewer to study them frame by frame.",
    image: "/hero/bg-2000.webp",
  });
}
