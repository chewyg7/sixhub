import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools";
import { listUsers } from "@/lib/auth/users";
import { listPages } from "@/lib/db/extras";
import { getProfileSettings } from "@/lib/profiles";
import { absolute, mediaImage, mediaSeoDescription, mediaSeoTitle } from "@/lib/seo";
import { flattenTree, getAllMedia, getCategories, getCollections, getFolderTree, getInfoEntries, getInfoSections, getLabelLookups } from "@/lib/content";

// Lists media and profiles added from the admin panel, so it's built on request.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [media, collections, sections, entries, categories, folders, labels] = await Promise.all([
    getAllMedia(),
    getCollections(),
    getInfoSections(),
    getInfoEntries(),
    getCategories(),
    getFolderTree(),
    getLabelLookups(),
  ]);
  const u = (path: string, lastModified?: string | number) => ({ url: `${SITE.url}${path}`, lastModified: lastModified ? new Date(lastModified) : undefined });
  const singular = (slug: string) => categories.find((c) => c.slug === slug)?.singular ?? "Media";
  const profiles = listUsers().filter((x) => !x.disabled && getProfileSettings(x.id).visible);

  return [
    ...["/", "/news", "/media", "/viewer", "/info", "/timeline", "/collections", "/tools", "/team", "/discord", "/faq", "/about", "/contact", "/privacy"].map((p) => u(p)),
    ...TOOLS.map((t) => u(t.href)),
    ...categories.map((c) => u(`/media/${c.slug}`)),
    ...flattenTree(folders).map((f) => u(`/media/folder/${f.path.join("/")}`)),
    // Each media page lists its picture (Google Images) and, for videos, the video itself.
    ...media.map((m) => {
      const image = mediaImage(m);
      const title = mediaSeoTitle(m, singular(m.category));
      return {
        ...u(`/media/${m.slug}`, m.dateAdded),
        images: image ? [image.url] : undefined,
        videos:
          m.kind === "video" && image
            ? [
                {
                  title,
                  thumbnail_loc: image.url,
                  description: mediaSeoDescription(m, singular(m.category), labels).slice(0, 2048),
                  content_loc: absolute(m.original.url),
                  duration: m.video ? Math.round(m.video.duration) : undefined,
                  publication_date: m.datePublished || undefined,
                },
              ]
            : undefined,
      };
    }),
    ...collections.map((c) => u(`/collections/${c.slug}`)),
    ...sections.map((s) => u(`/info/${s.slug}`)),
    ...entries.map((e) => u(`/info/${e.section}/${e.slug}`, e.lastReviewed)),
    ...listPages({ published: true }).map((p) => u(`/p/${p.slug}`, p.updatedAt)),
    ...profiles.map((x) => u(`/@${x.username}`)),
  ];
}
