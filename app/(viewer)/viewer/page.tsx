import type { Metadata } from "next";
import { getAllMedia } from "@/lib/content";
import { ViewerLoader } from "@/features/media-viewer/viewer-loader";

export const metadata: Metadata = {
  title: "Media Viewer",
  description:
    "Analyze GTA VI trailers, screenshots, artwork and audio: frame-by-frame stepping, pixel zoom, crop, frame capture at native resolution, and side-by-side comparison.",
  alternates: { canonical: "/viewer" },
};

export default async function ViewerPage() {
  const items = await getAllMedia();
  return (
    <>
      <h1 className="sr-only">GTA 6 Hub Media Viewer</h1>
      <ViewerLoader items={items} />
    </>
  );
}
