import type { NextRequest } from "next/server";
import { ogImage } from "@/lib/og";
import { pluralize } from "@/lib/format";
import { getRepoPreview } from "@/lib/repo-preview";

/**
 * GET /og/repo?url=<repo json> — the link-preview card for a shared repo
 * (share links are /media/repos/add?url=…, so the card is built per link).
 */
export async function GET(request: NextRequest) {
  const link = (request.nextUrl.searchParams.get("url") ?? "").slice(0, 2048);
  const repo = await getRepoPreview(link);
  const res = repo
    ? await ogImage({
        kicker: `Repo by ${repo.author}`,
        title: repo.name,
        lede: repo.description || `${pluralize(repo.count, "item")} to browse in the GTA 6 Hub viewer.`,
        image: repo.picture ?? "/hero/bg-2000.webp",
        fit: repo.picture ? repo.pictureFit : "cover",
      })
    : await ogImage({ kicker: "Media", title: "Shared repo", lede: "A collection of GTA VI media, shared on GTA 6 Hub.", image: "/hero/bg-2000.webp" });
  // Shared links get fetched a lot; let caches keep the card for a while.
  res.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res;
}
