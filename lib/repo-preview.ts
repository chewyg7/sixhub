import "server-only";
import { parseManifest, REPO_LIMITS } from "@/lib/repo-manifest";
import { safeFetch } from "@/lib/safe-fetch";

/**
 * What a shared repo link shows in Discord and friends: its name, author,
 * description and a picture. Only the repo's JSON and one picture are read,
 * just to draw the preview; none of its media is stored or served here.
 */
export interface RepoPreview {
  name: string;
  author: string;
  description: string;
  count: number;
  /** A data URI (fetched safely), so the card renderer never fetches visitor-supplied links itself. */
  picture?: string;
  pictureFit: "cover" | "contain";
}

async function pictureData(url: string | undefined) {
  if (!url) return undefined;
  try {
    const { body, type } = await safeFetch(url, { maxBytes: 8 * 1024 * 1024, revalidate: 0 });
    if (!/^image\//.test(type) || /svg/.test(type)) return undefined;
    return `data:${type.split(";")[0]};base64,${body.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** `withPicture: false` skips the picture (page titles don't need it). */
export async function getRepoPreview(link: string, { withPicture = true } = {}): Promise<RepoPreview | null> {
  if (!/^https:\/\//i.test(link)) return null;
  try {
    const { body, url } = await safeFetch(link, { maxBytes: REPO_LIMITS.bytes });
    const m = parseManifest(JSON.parse(body.toString("utf8")), url);
    // A still from the repo makes the best card; else its icon.
    const still = m.items.find((i) => i.kind === "image");
    const cover = still?.thumbnail ?? still?.url ?? m.items.find((i) => i.thumbnail)?.thumbnail;
    const picture = withPicture ? await pictureData(cover) : undefined;
    const icon = withPicture && !picture ? await pictureData(m.icon) : undefined;
    return { name: m.name, author: m.author, description: m.description, count: m.items.length, picture: picture ?? icon, pictureFit: picture ? "cover" : "contain" };
  } catch {
    return null;
  }
}
