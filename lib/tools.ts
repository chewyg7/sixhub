/** The fan tools under /tools, shown in the header's Tools menu and on /tools. */
export interface Tool {
  slug: string;
  href: string;
  name: string;
  /** One line for menus. */
  blurb: string;
  /** A couple of sentences for the /tools page. */
  description: string;
  /** Preview image for the /tools card. */
  image: string;
  /** Picture for the small menu icon, when the preview doesn't crop well. */
  icon?: string;
  /** How it sits in the menu icon: whole (logos, the plate) or filling it (photos). */
  iconFit: "contain" | "cover";
}

export const TOOLS: Tool[] = [
  {
    slug: "plate",
    href: "/tools/plate",
    name: "Leonida Plate Creator",
    blurb: "Leonida and Gloriana plates, in 3D",
    description: "Type your plate, pick a style and a frame, then flip to 3D to turn the stamped plate in your hands or see it bolted to the back of a car. Save it as a PNG.",
    image: "/tools/plate/preview.webp",
    icon: "/tools/plate/icon.webp",
    iconFit: "contain",
  },
  {
    slug: "text-generator",
    href: "/tools/text-generator",
    name: "VI Text Generator",
    blurb: "Any word in the GTA VI title lettering",
    description: "Type anything and get it in the GTA VI title style, with colour, mono, overlay and 3D looks. Download it as a transparent PNG.",
    image: "/vi-text/images/style_color_white.png",
    iconFit: "contain",
  },
  {
    slug: "wallpaper",
    href: "/tools/wallpaper",
    name: "Wallpaper Maker",
    blurb: "Official art, cropped for any screen",
    description: "Pick official artwork, choose your phone, desktop or ultrawide size, frame it, add the VI logo if you like, and save it at full resolution.",
    image: "/media/gv/gv-mount-kalaga-national-park-poster/w960.webp",
    iconFit: "cover",
  },
];
