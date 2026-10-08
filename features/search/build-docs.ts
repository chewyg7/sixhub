import "server-only";
import { flattenTree, getAllMedia, getCategories, getCollections, getFaq, getFolderTree, getInfoEntries, getInfoSections, getLabelLookups, getTimeline } from "@/lib/content";
import { smallestVariant } from "@/lib/media/variants";
import { formatDate } from "@/lib/format";
import type { SearchDoc } from "./engine";

const PAGES: SearchDoc[] = [
  { id: "page:home", type: "page", title: "Home", href: "/", text: "latest start" },
  { id: "page:news", type: "page", title: "News", href: "/news", text: "latest articles rockstarintel stories" },
  { id: "page:media", type: "page", title: "Media Archive", href: "/media", text: "all media browse archive gallery" },
  { id: "page:viewer", type: "page", title: "Media Viewer", href: "/viewer", text: "analyze frame by frame compare crop zoom capture tool" },
  { id: "page:info", type: "page", title: "Information Database", href: "/info", text: "wiki database facts" },
  { id: "page:timeline", type: "page", title: "Timeline", href: "/timeline", text: "history events announcements dates" },
  { id: "page:collections", type: "page", title: "Collections", href: "/collections", text: "releases sets batches" },
  { id: "page:library", type: "page", title: "Your Library", href: "/library", text: "favorites saved collections recently viewed history" },
  { id: "page:faq", type: "page", title: "FAQ", href: "/faq", text: "questions answers help release date time zones launch" },
];

/** Every searchable non-news document on the site. News is searched live. */
export async function buildSearchDocs(): Promise<SearchDoc[]> {
  const [media, collections, entries, sections, timeline, labels, categories, folders, faq] = await Promise.all([
    getAllMedia(),
    getCollections(),
    getInfoEntries(),
    getInfoSections(),
    getTimeline(),
    getLabelLookups(),
    getCategories(),
    getFolderTree(),
    getFaq(),
  ]);
  const sectionTitle = Object.fromEntries(sections.map((s) => [s.slug, s.title]));

  const docs: SearchDoc[] = [
    ...PAGES,
    ...categories.map((c) => ({ id: `page:media:${c.slug}`, type: "page" as const, title: c.label, subtitle: "Media category", href: `/media/${c.slug}`, text: c.description })),
    ...flattenTree(folders).map((f) => ({
      id: `folder:${f.id}`,
      type: "page" as const,
      title: f.name,
      subtitle: `Folder · ${f.total} items`,
      href: `/media/folder/${f.path.join("/")}`,
      text: [f.description, ...f.path].join(" "),
    })),
    ...faq.map((f) => ({ id: `faq:${f.id}`, type: "page" as const, title: f.question, subtitle: "FAQ", href: `/faq#${f.id}`, text: f.answer })),
  ];
  for (const m of media) {
    docs.push({
      id: `media:${m.slug}`,
      type: "media",
      title: m.title,
      subtitle: `${labels.categories[m.category] ?? m.category} · ${m.source.label} · ${formatDate(m.datePublished, "short")}`,
      href: `/media/${m.slug}`,
      text: [
        m.kind,
        m.category,
        m.source.label,
        ...m.tags,
        ...m.characters.map((c) => labels.characters[c] ?? c),
        ...m.locations.map((l) => labels.locations[l] ?? l),
        ...m.collections.map((c) => labels.collections[c] ?? c),
      ].join(" "),
      thumb: smallestVariant(m, 200)?.url,
      date: m.datePublished,
      slug: m.slug,
    });
  }
  for (const e of entries) {
    const type = e.section === "characters" ? "character" : e.section === "locations" ? "location" : "info";
    docs.push({
      id: `info:${e.id}`,
      type,
      title: e.name,
      subtitle: type === "info" ? sectionTitle[e.section] : e.subtitle,
      href: `/info/${e.section}/${e.slug}`,
      text: `${e.summary} ${e.facts.map((f) => f.value).join(" ")}`,
      thumb: e.imageSlug ? smallestVariant(media.find((m) => m.slug === e.imageSlug) ?? { variants: [] }, 200)?.url : undefined,
    });
  }
  for (const s of sections) {
    docs.push({ id: `section:${s.slug}`, type: "info", title: s.title, subtitle: "Information", href: `/info/${s.slug}`, text: s.description });
  }
  for (const c of collections) {
    const cover = media.find((m) => m.slug === c.coverSlug);
    docs.push({
      id: `collection:${c.slug}`,
      type: "collection",
      title: c.title,
      subtitle: `${c.mediaSlugs.length} items${c.date ? ` · ${formatDate(c.date, "short")}` : ""}`,
      href: `/collections/${c.slug}`,
      text: c.description,
      thumb: cover ? smallestVariant(cover, 200)?.url : undefined,
      date: c.date,
    });
  }
  for (const t of timeline) {
    docs.push({ id: `timeline:${t.id}`, type: "timeline", title: t.title, subtitle: formatDate(t.date), href: `/timeline#${t.id}`, text: `${t.summary} ${t.type}`, date: t.date });
  }
  return docs;
}
