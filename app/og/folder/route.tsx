import type { NextRequest } from "next/server";
import { mediaPicture, ogImage } from "@/lib/og";
import { getFolderByPath } from "@/lib/content";
import { pluralize } from "@/lib/format";

/**
 * GET /og/folder?path=artwork/posters — the link-preview card for a media
 * folder. (A catch-all route can't hold an opengraph-image file, so folder
 * pages point their og:image here.)
 */
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const path = (request.nextUrl.searchParams.get("path") ?? "").split("/").filter(Boolean).slice(0, 8);
  const found = path.length ? await getFolderByPath(path) : null;
  const res = found ? await card(found) : await ogImage({ title: "Media Archive", image: "/hero/bg-2000.webp" });
  // Link previews are fetched a lot when a link is shared; let caches keep it for a while.
  res.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res;
}

function card({ folder, trail }: NonNullable<Awaited<ReturnType<typeof getFolderByPath>>>) {
  return ogImage({
    kicker: trail.length > 1 ? trail.slice(0, -1).map((t) => t.name).join(" · ") : "Media",
    title: folder.name,
    lede: folder.description || `${pluralize(folder.total, "official GTA VI media item")}.`,
    image: mediaPicture(folder.cover) ?? "/hero/bg-2000.webp",
  });
}
