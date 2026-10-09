import type { MetadataRoute } from "next";

/** Web app manifest: lets phones install GTA 6 Hub to the home screen as a full-screen app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GTA 6 Hub",
    short_name: "GTA 6 Hub",
    description: "GTA VI news, the media archive, the Media Viewer and fan tools.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#0b0910",
    theme_color: "#0b0910",
    categories: ["entertainment", "games", "news"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "News", url: "/news", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Media", url: "/media", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Media Viewer", url: "/viewer", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Tools", url: "/tools", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
