import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Container, Breadcrumbs, SectionHeading } from "@/components/layout/page";
import { EntryCard } from "@/components/info/entry-card";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaThumb } from "@/components/media/media-thumb";
import { LightboxTrigger } from "@/components/media/lightbox-trigger";
import { Badge } from "@/components/ui/controls";
import { RelatedNews } from "@/features/news/related-news";
import { getAllMedia, getCollections, getInfoEntries, getInfoEntry, getInfoSections } from "@/lib/content";
import { byNewest } from "@/lib/content/relations";
import { formatDate, pluralize } from "@/lib/format";
import type { InfoSectionSlug } from "@/types/content";

export async function generateStaticParams() {
  return (await getInfoEntries()).map((e) => ({ section: e.section, slug: e.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/info/[section]/[slug]">): Promise<Metadata> {
  const { section, slug } = await params;
  const e = await getInfoEntry(section as InfoSectionSlug, slug);
  return e ? { title: e.name, description: e.summary, alternates: { canonical: `/info/${section}/${slug}` } } : {};
}

const VERIFY_LABEL = { official: "Official", reported: "Reported", community: "Community" } as const;

export default async function InfoEntryPage({ params }: PageProps<"/info/[section]/[slug]">) {
  const { section: sectionSlug, slug } = await params;
  const entry = await getInfoEntry(sectionSlug as InfoSectionSlug, slug);
  if (!entry) notFound();
  const [sections, entries, media, collections] = await Promise.all([getInfoSections(), getInfoEntries(), getAllMedia(), getCollections()]);
  const section = sections.find((s) => s.slug === entry.section)!;
  const bySlug = new Map(media.map((m) => [m.slug, m]));
  const image = entry.imageSlug ? bySlug.get(entry.imageSlug) : undefined;

  // Everything connected to this entry through the tag system.
  const tagged = media
    .filter(
      (m) =>
        (entry.section === "characters" && m.characters.includes(entry.slug)) ||
        (entry.section === "locations" && m.locations.includes(entry.slug)) ||
        entry.relatedCollections.some((c) => m.collections.includes(c)),
    )
    .sort(byNewest);
  const stills = tagged.filter((m) => m.kind === "image");
  const videos = tagged.filter((m) => m.kind === "video");
  const appearances = collections.filter((c) => entry.relatedCollections.includes(c.slug) || tagged.some((m) => m.collections.includes(c.slug)));
  const relatedChars = entries.filter((e) => e.section === "characters" && entry.relatedCharacters.includes(e.slug));
  const relatedPlaces = entries.filter((e) => e.section === "locations" && entry.relatedLocations.includes(e.slug));
  const filterKey = entry.section === "characters" ? "character" : entry.section === "locations" ? "location" : null;

  return (
    <Container className="pt-6">
      <Breadcrumbs items={[{ href: "/info", label: "Information" }, { href: `/info/${section.slug}`, label: section.title }, { label: entry.name }]} />

      <header className={image ? "mt-8 grid gap-8 md:grid-cols-[minmax(0,340px)_1fr] lg:gap-12" : "mt-8"}>
        {image && (
          <LightboxTrigger items={[image]} label={`View image of ${entry.name}`} className="block self-start">
            <MediaThumb item={image} sizes="(min-width: 768px) 340px, 100vw" aspect={entry.section === "characters" ? "3 / 4" : "4 / 3"} rounded="rounded-2xl" showKind={false} />
          </LightboxTrigger>
        )}
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.subtitle && <Badge>{entry.subtitle}</Badge>}
            <Badge tone={entry.verification === "official" ? "outline" : "sample"}>{VERIFY_LABEL[entry.verification]}</Badge>
          </div>
          <h1 className="display-tight mt-4 text-[56px] sm:text-[80px]">{entry.name}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">{entry.summary}</p>

          {entry.facts.length > 0 && (
            <dl className="mt-6 grid max-w-xl grid-cols-[140px_1fr] gap-x-4 gap-y-2 border-t border-divider pt-5 text-[13.5px]">
              {entry.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="text-text">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {entry.body.length > 0 && (
            <div className="prose-gh mt-6 max-w-2xl">
              {entry.body.map((b, i) =>
                b.type === "paragraph" ? (
                  <p key={i}>{b.text}</p>
                ) : b.type === "list" ? (
                  <ul key={i}>
                    {b.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className="rounded-lg border border-divider bg-surface px-4 py-3 text-[13.5px]">
                    {b.text}
                  </p>
                ),
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-faint">
            {entry.sources.map((s) => (
              <a key={s.url + s.label} href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted hover:text-text">
                Source: {s.label} <ArrowUpRight className="size-3.5" />
              </a>
            ))}
            <span>Reviewed {formatDate(entry.lastReviewed)}</span>
          </div>
        </div>
      </header>

      {appearances.length > 0 && (
        <section className="mt-16" aria-labelledby="appear-h">
          <h2 id="appear-h" className="eyebrow mb-3">
            Appears in
          </h2>
          <ul className="flex flex-wrap gap-2">
            {appearances.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="block rounded-lg border border-border px-4 py-3 transition-colors hover:bg-surface">
                  <span className="block text-[14px] font-semibold">{c.title}</span>
                  <span className="text-[12.5px] text-muted">{c.date ? formatDate(c.date) : pluralize(c.mediaSlugs.length, "item")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length > 0 && (
        <section className="mt-14" aria-labelledby="videos-h">
          <SectionHeading id="videos-h" title="Videos" href={filterKey ? `/media?${filterKey}=${entry.slug}&type=video` : undefined} />
          <MediaGrid items={videos} columns={3} />
        </section>
      )}

      {stills.length > 0 && (
        <section className="mt-14" aria-labelledby="stills-h">
          <SectionHeading
            id="stills-h"
            title="Screenshots & artwork"
            description={`${pluralize(stills.length, "image")} tagged with ${entry.name}.`}
            href={filterKey ? `/media?${filterKey}=${entry.slug}` : undefined}
            linkLabel="Open in archive"
          />
          <MediaGrid items={stills.slice(0, 12)} />
        </section>
      )}

      {tagged.length === 0 && (entry.section === "characters" || entry.section === "locations") && (
        <p className="mt-14 rounded-xl border border-dashed border-border-strong px-5 py-8 text-center text-[13.5px] text-muted">
          No media in the archive is tagged with {entry.name} yet.
        </p>
      )}

      {(relatedChars.length > 0 || relatedPlaces.length > 0) && (
        <section className="mt-16" aria-labelledby="rel-h">
          <h2 id="rel-h" className="display mb-5 text-[28px]">
            Connected
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {[...relatedChars, ...relatedPlaces].map((e) => (
              <EntryCard key={e.id} entry={e} image={e.imageSlug ? bySlug.get(e.imageSlug) : undefined} layout={e.section === "characters" ? "profile" : "place"} />
            ))}
          </div>
        </section>
      )}

      {entry.newsQuery && (
        <section className="mt-16 max-w-4xl" aria-labelledby="news-h">
          <SectionHeading
            id="news-h"
            title="In the news"
            description={`Live coverage mentioning ${entry.newsQuery}.`}
            href={`/news?q=${encodeURIComponent(entry.newsQuery)}`}
            linkLabel="More"
          />
          <RelatedNews query={entry.newsQuery} limit={4} />
        </section>
      )}
    </Container>
  );
}
