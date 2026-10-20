import { ogImage } from "@/lib/og";

export const alt = "Leonida Plate Creator on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    kicker: "Tools",
    title: "Leonida Plate Creator",
    lede: "Design your own Leonida or Gloriana plate, then see it stamped in 3D.",
    image: "/tools/plate/preview.webp",
  });
}
