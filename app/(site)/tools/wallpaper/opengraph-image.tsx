import { ogImage } from "@/lib/og";

export const alt = "Wallpaper Maker on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    kicker: "Tools",
    title: "Wallpaper Maker",
    lede: "Official GTA VI art, cropped for your phone, desktop or ultrawide.",
    image: "/media/gv/gv-mount-kalaga-national-park-poster/w960.webp",
  });
}
