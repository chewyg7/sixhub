import { mediaPicture, ogImage } from "@/lib/og";
import { getInfoEntry, getInfoSections, getMediaBySlug } from "@/lib/content";
import { displayName, imageUrl, memberBySlug, wikiSection } from "@/lib/wiki/api";
import { getWikiArticle } from "@/lib/wiki/article";

export const alt = "GTA 6 information on GTA 6 Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params;
  const [entry, sections] = await Promise.all([getInfoEntry(section, slug), getInfoSections()]);
  const kicker = sections.find((s) => s.slug === section)?.title ?? wikiSection(section)?.title ?? "Information";
  const member = wikiSection(section) ? await memberBySlug(section, slug) : null;
  const article = member ? await getWikiArticle(member.title) : null;
  const own = entry?.imageSlug ? mediaPicture(await getMediaBySlug(entry.imageSlug)) : undefined;
  const wikiImage = article?.image ? imageUrl(article.image.file, 1280, article.image.width) : undefined;
  if (!entry && !member) return ogImage({ title: "Information", image: "/hero/bg-2000.webp" });
  return ogImage({
    kicker,
    title: entry?.name ?? displayName(member!.title),
    lede: entry?.summary || article?.summary,
    image: own ?? wikiImage ?? "/hero/bg-2000.webp",
  });
}
