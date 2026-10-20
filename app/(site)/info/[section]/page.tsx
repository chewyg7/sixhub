import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, PageHeader, SectionHeading } from "@/components/layout/page";
import { EntryCard } from "@/components/info/entry-card";
import { WikiGrid, type WikiCard } from "@/components/info/wiki-grid";
import { EmptyState } from "@/components/ui/states";
import { RelatedNews } from "@/features/news/related-news";
import { getAllMedia, getInfoEntries, getInfoSections } from "@/lib/content";
import { mediaForCharacter, mediaForLocation } from "@/lib/content/relations";
import { pluralize } from "@/lib/format";
import { smallestVariant } from "@/lib/media/variants";
import { WIKI_LICENSE, WIKI_SECTIONS, displayName, imageUrl, sectionMembers, wikiSection, wikiSlug } from "@/lib/wiki/api";
import type { InfoSectionSlug } from "@/types/content";

export async function generateStaticParams() {
  const slugs = new Set([...(await getInfoSections()).map((s) => s.slug), ...WIKI_SECTIONS.map((s) => s.slug)]);
  return [...slugs].map((section) => ({ section }));
}
// Pages for entries added in the admin panel render on first visit. (With `false`, Next.js
// 404s every path here after an admin save revalidates the site.)
export const dynamicParams = true;

/** A section's title and blurb: the admin panel's if it has one, else the wiki section's. */
async function getSection(slug: string) {
  const db = (await getInfoSections()).find((s) => s.slug === slug);
  const wiki = wikiSection(slug);
  if (!db && !wiki) return null;
  return { slug, title: db?.title ?? wiki!.title, description: db?.description ?? wiki!.description, db, wiki };
}

export async function generateMetadata({ params }: PageProps<"/info/[section]">): Promise<Metadata> {
  const s = await getSection((await params).section);
  return s ? { title: `${s.title} in GTA 6`, description: s.description, alternates: { canonical: `/info/${s.slug}` } } : {};
}

export default async function InfoSectionPage({ params }: PageProps<"/info/[section]">) {
  const section = await getSection((await params).section);
  if (!section) notFound();
  const [entries, media] = await Promise.all([getInfoEntries(section.slug as InfoSectionSlug), getAllMedia()]);
  const bySlug = new Map(media.map((m) => [m.slug, m]));
  const count = (slug: string) => (section.slug === "characters" ? mediaForCharacter(media, slug).length : section.slug === "locations" ? mediaForLocation(media, slug).length : 0);

  if (section.wiki) {
    // Everything the wiki lists, plus anything added in the admin panel that it doesn't have yet.
    const members = await sectionMembers(section.slug);
    const listed = new Set(members.map((m) => m.slug));
    const own = new Map(entries.map((e) => [e.slug, e]));
    const cards: WikiCard[] = [
      ...members.map((m) => {
        const n = own.has(m.slug) ? count(m.slug) : 0;
        return { title: displayName(m.title), href: `/info/${section.slug}/${m.slug}`, image: m.image ? imageUrl(m.image, section.wiki!.shape === "portrait" ? 480 : 640) : undefined, note: n ? pluralize(n, "media item") : undefined };
      }),
      ...entries
        .filter((e) => !listed.has(e.slug) && !listed.has(wikiSlug(e.name)))
        .map((e) => {
          const img = e.imageSlug ? bySlug.get(e.imageSlug) : undefined;
          return { title: e.name, href: `/info/${section.slug}/${e.slug}`, image: img ? smallestVariant(img, 480)?.url : undefined, note: count(e.slug) ? pluralize(count(e.slug), "media item") : undefined };
        }),
    ].sort((a, b) => a.title.localeCompare(b.title));

    return (
      <Container>
        <PageHeader compact crumbs={[{ href: "/info", label: "Information" }, { label: section.title }]} title={section.title} lede={section.description} />
        {cards.length ? (
          <WikiGrid items={cards} shape={section.wiki.shape} noun={section.wiki.plural} />
        ) : (
          <EmptyState title="Couldn’t reach GTA Wiki" description="This list comes from GTA Wiki, which didn’t answer just now. Try again in a minute." />
        )}
        <p className="mt-14 text-[12.5px] text-faint">
          Entries and pictures from{" "}
          <a href="https://gta.wiki" target="_blank" rel="noopener" className="wiki-link">
            GTA Wiki
          </a>{" "}
          ({WIKI_LICENSE.name}), GTA VI content only.
        </p>
      </Container>
    );
  }

  const db = section.db!;
  return (
    <Container>
      <PageHeader compact crumbs={[{ href: "/info", label: "Information" }, { label: section.title }]} title={section.title} lede={section.description} />
      {entries.length === 0 ? (
        <EmptyState
          title={`No verified ${db.entryNoun} entries yet`}
          description={`Entries are added here once Rockstar confirms them in official media or announcements. Recent coverage is below.`}
        />
      ) : db.layout === "list" ? (
        <div className="border-t border-divider">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} image={e.imageSlug ? bySlug.get(e.imageSlug) : undefined} layout="row" />
          ))}
        </div>
      ) : (
        <div className={db.layout === "profiles" ? "grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"}>
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              image={e.imageSlug ? bySlug.get(e.imageSlug) : undefined}
              layout={db.layout === "profiles" ? "profile" : "place"}
              mediaCount={count(e.slug)}
            />
          ))}
        </div>
      )}

      {db.newsQuery && (
        <section className="mt-16 max-w-4xl" aria-labelledby="sec-news">
          <SectionHeading
            id="sec-news"
            title="Related coverage"
            description={`Recent GTA VI news mentioning “${db.newsQuery}”.`}
            href={`/news?q=${encodeURIComponent(db.newsQuery)}`}
            linkLabel="More"
          />
          <RelatedNews query={db.newsQuery} limit={4} layout="compact" />
        </section>
      )}
    </Container>
  );
}
