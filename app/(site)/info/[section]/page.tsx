import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, PageHeader, SectionHeading } from "@/components/layout/page";
import { EntryCard } from "@/components/info/entry-card";
import { EmptyState } from "@/components/ui/states";
import { RelatedNews } from "@/features/news/related-news";
import { getAllMedia, getInfoEntries, getInfoSections } from "@/lib/content";
import { mediaForCharacter, mediaForLocation } from "@/lib/content/relations";
import type { InfoSectionSlug } from "@/types/content";

export async function generateStaticParams() {
  return (await getInfoSections()).map((s) => ({ section: s.slug }));
}
// Pages for entries added in the admin panel render on first visit. (With `false`, Next.js
// 404s every path here after an admin save revalidates the site.)
export const dynamicParams = true;

async function getSection(slug: string) {
  return (await getInfoSections()).find((s) => s.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/info/[section]">): Promise<Metadata> {
  const s = await getSection((await params).section);
  return s ? { title: s.title, description: s.description, alternates: { canonical: `/info/${s.slug}` } } : {};
}

export default async function InfoSectionPage({ params }: PageProps<"/info/[section]">) {
  const section = await getSection((await params).section);
  if (!section) notFound();
  const [entries, media] = await Promise.all([getInfoEntries(section.slug as InfoSectionSlug), getAllMedia()]);
  const bySlug = new Map(media.map((m) => [m.slug, m]));
  const count = (slug: string) => (section.slug === "characters" ? mediaForCharacter(media, slug).length : section.slug === "locations" ? mediaForLocation(media, slug).length : 0);

  return (
    <Container>
      <PageHeader crumbs={[{ href: "/info", label: "Information" }, { label: section.title }]} title={section.title} lede={section.description} />
      {entries.length === 0 ? (
        <EmptyState
          title={`No verified ${section.entryNoun} entries yet`}
          description={`Entries are added here once Rockstar confirms them in official media or announcements. Recent coverage is below.`}
        />
      ) : section.layout === "list" ? (
        <div className="border-t border-divider">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} image={e.imageSlug ? bySlug.get(e.imageSlug) : undefined} layout="row" />
          ))}
        </div>
      ) : (
        <div
          className={
            section.layout === "profiles" ? "grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              image={e.imageSlug ? bySlug.get(e.imageSlug) : undefined}
              layout={section.layout === "profiles" ? "profile" : "place"}
              mediaCount={count(e.slug)}
            />
          ))}
        </div>
      )}

      {section.newsQuery && (
        <section className="mt-16 max-w-4xl" aria-labelledby="sec-news">
          <SectionHeading
            id="sec-news"
            title="Related coverage"
            description={`Recent GTA VI news mentioning “${section.newsQuery}”.`}
            href={`/news?q=${encodeURIComponent(section.newsQuery)}`}
            linkLabel="More"
          />
          <RelatedNews query={section.newsQuery} limit={4} layout="compact" />
        </section>
      )}
    </Container>
  );
}
