import { ogImage } from "@/lib/og";

export const alt = "VI Text Generator on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    kicker: "Tools",
    title: "VI Text Generator",
    lede: "Any word in the GTA VI title lettering, saved as a PNG.",
    image: "/vi-text/images/style_color_white.png",
    fit: "contain",
  });
}
