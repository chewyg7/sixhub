import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Container, Breadcrumbs, SectionHeading } from "@/components/layout/page";
import { EntryCard } from "@/components/info/entry-card";
import { WikiCredit, WikiInfoboxCard, WikiSections } from "@/components/info/wiki-article";
import { WikiContent } from "@/components/info/wiki-content";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaThumb } from "@/components/media/media-thumb";
import { LightboxTrigger } from "@/components/media/lightbox-trigger";
import { Badge } from "@/components/ui/controls";
import { RelatedNews } from "@/features/news/related-news";
import { getAllMedia, getCollections, getInfoEntries, getInfoEntry, getInfoSections } from "@/lib/content";
import { byNewest } from "@/lib/content/relations";
import { formatDate, pluralize } from "@/lib/format";
import { displayName, memberBySlug, wikiIndex, wikiSection, wikiSlug } from "@/lib/wiki/api";
import { getWikiArticle } from "@/lib/wiki/article";
import type { InfoEntry, InfoSectionSlug } from "@/types/content";

export async function generateStaticParams() {
  return (await getInfoEntries()).map((e) => ({ section: e.section, slug: e.slug }));
}
// Entries added in the admin panel and every GTA Wiki article render on first visit,
// then stay cached. (With `false`, Next.js 404s every path here after an admin save.)
export const dynamicParams = true;

/** The admin panel's entry and/or the wiki article behind a URL. */
async function resolve(section: string, slug: string) {
  const entry = await getInfoEntry(section as InfoSectionSlug, slug);
  const member = wikiSection(section) ? ((await memberBySlug(section, slug)) ?? (entry ? await memberBySlug(section, wikiSlug(entry.name)) : null)) : null;
  return { entry, member };
}

export async function generateMetadata({ params }: PageProps<"/info/[section]/[slug]">): Promise<Metadata> {
  const { section, slug } = await params;
  const { entry, member } = await resolve(section, slug);
  if (entry) return { title: entry.name, description: entry.summary, alternates: { canonical: `/info/${section}/${slug}` } };
  if (!member) return {};
  const article = await getWikiArticle(member.title);
  return { title: `${displayName(member.title)} in GTA 6`, description: article?.summary.slice(0, 300) || undefined, alternates: { canonical: `/info/${section}/${slug}` } };
}

const VERIFY_LABEL = { official: "Official", reported: "Reported", community: "Community" } as const;

export default async function InfoEntryPage({ params }: PageProps<"/info/[section]/[slug]">) {
  const { section: sectionSlug, slug } = await params;
  const { entry, member } = await resolve(sectionSlug, slug);
  if (!entry && !member) notFound();
  const [sections, article, links] = await Promise.all([getInfoSections(), member ? getWikiArticle(member.title) : null, member ? wikiIndex() : null]);
  const sectionTitle = sections.find((s) => s.slug === sectionSlug)?.title ?? wikiSection(sectionSlug)?.title ?? sectionSlug;
  const name = entry?.name ?? displayName(member!.title);
  const crumbs = [{ href: "/info", label: "Information" }, { href: `/info/${sectionSlug}`, label: sectionTitle }, { label: name }];

  if (!article || !links) {
    if (entry) return <DbEntry entry={entry} crumbs={crumbs} />;
    return (
      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <h1 className="display-tight mt-8 text-[56px] sm:text-[80px]">{name}</h1>
        <p className="mt-4 max-w-xl text-[16px] text-muted">This article comes from GTA Wiki, which didn’t answer just now. Try again in a minute.</p>
      </Container>
    );
  }

  // Pages about several games often lose their (other-game) infobox picture; use the GTA VI one from the listing.
  const box = member?.image && !article.infobox?.image ? { kind: article.infobox?.kind, groups: article.infobox?.groups ?? [], image: { file: member.image } } : article.infobox;

  return (
    <Container className="pt-6">
      <Breadcrumbs items={crumbs} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <div className="min-w-0">
          {box?.kind && <Badge>{box.kind.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>}
          <h1 className="display-tight mt-4 text-[52px] sm:text-[76px]">{name}</h1>
          <WikiContent nodes={article.lead} links={links} className="mt-6 max-w-3xl text-[17px]!" />
          <div className="mt-14 max-w-3xl">
            <WikiSections article={article} links={links} />
          </div>
        </div>
        {box && (
          <div className="lg:sticky lg:top-28 lg:self-start">
            <WikiInfoboxCard box={box} title={name} links={links} />
          </div>
        )}
      </div>

      {entry && <EntryArchive entry={entry} />}
      <WikiCredit url={article.url} title={article.title} />
    </Container>
  );
}

/** An entry written in the admin panel, with no wiki article behind it. */
async function DbEntry({ entry, crumbs }: { entry: InfoEntry; crumbs: { href?: string; label: string }[] }) {
  const media = await getAllMedia();
  const image = entry.imageSlug ? media.find((m) => m.slug === entry.imageSlug) : undefined;
  return (
    <Container className="pt-6">
      <Breadcrumbs items={crumbs} />

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

      <EntryArchive entry={entry} />
    </Container>
  );
}

/** What the site's own archive has for an entry: its media, collections, connections and news. */
async function EntryArchive({ entry }: { entry: InfoEntry }) {
  const [entries, media, collections] = await Promise.all([getInfoEntries(), getAllMedia(), getCollections()]);
  const bySlug = new Map(media.map((m) => [m.slug, m]));
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
    <>
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
    </>
  );
}
