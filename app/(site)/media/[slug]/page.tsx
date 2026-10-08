import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { Container, PageHeader, Breadcrumbs, SectionHeading } from "@/components/layout/page";
import { Badge } from "@/components/ui/controls";
import { MediaStage, MediaActions } from "@/components/media/media-detail-client";
import { MetadataTable } from "@/components/media/metadata-table";
import { TagList } from "@/components/media/tag-list";
import { MediaGrid } from "@/components/media/media-grid";
import { ArchiveView } from "@/features/archive/archive-view";
import { ArchiveFallback } from "@/features/archive/archive-fallback";
import { folderHref, getAllMedia, getCategories, getCollections, getLabelLookups, getMediaByCategory, getMediaBySlug, getSources } from "@/lib/content";
import { mediaTags, relatedMedia } from "@/lib/content/relations";
import { smallestVariant } from "@/lib/media/variants";
import { formatDate, pluralize, resolutionTier } from "@/lib/format";

/**
 * /media/<category> renders the archive scoped to a category;
 * /media/<item-slug> renders the item's detail page.
 */
export async function generateStaticParams() {
  const [items, categories] = await Promise.all([getAllMedia(), getCategories()]);
  return [...categories.map((c) => ({ slug: c.slug })), ...items.map((m) => ({ slug: m.slug }))];
}

// Media added from the admin panel after the build renders on first visit.
export const dynamicParams = true;

async function categoryBySlug(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/media/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await categoryBySlug(slug);
  if (c) {
    return { title: c.label, description: c.description, alternates: { canonical: `/media/${slug}` } };
  }
  const item = await getMediaBySlug(slug);
  if (!item) return {};
  const og = smallestVariant(item, 1200);
  return {
    title: item.title,
    description: item.description,
    alternates: { canonical: `/media/${slug}` },
    openGraph: { title: item.title, description: item.description, images: og ? [{ url: og.url, width: og.width, height: og.height, alt: item.alt }] : undefined },
  };
}

export default async function MediaSlugPage({ params }: PageProps<"/media/[slug]">) {
  const { slug } = await params;
  if (await categoryBySlug(slug)) return <CategoryArchive category={slug} />;
  const item = await getMediaBySlug(slug);
  if (!item) notFound();
  return <MediaDetail slug={slug} />;
}

async function CategoryArchive({ category }: { category: string }) {
  const [items, lookups, categories, sources] = await Promise.all([getMediaByCategory(category), getLabelLookups(), getCategories(), getSources()]);
  const c = categories.find((x) => x.slug === category)!;
  const labels = { characters: lookups.characters, locations: lookups.locations, sources: Object.fromEntries(sources.map((s) => [s.slug, s.label])) };
  return (
    <Container>
      <PageHeader crumbs={[{ href: "/media", label: "Media" }, { label: c.label }]} eyebrow={pluralize(items.length, "item")} title={c.label} lede={c.description} />
      <nav aria-label="Categories" className="no-scrollbar -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Link href="/media" className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-[13px] text-muted hover:text-text">
          All
        </Link>
        {categories.map((x) => (
          <Link
            key={x.slug}
            href={`/media/${x.slug}`}
            aria-current={x.slug === category ? "page" : undefined}
            className={
              x.slug === category
                ? "inline-flex h-8 shrink-0 items-center rounded-md bg-text px-3 text-[13px] font-medium text-bg"
                : "inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-[13px] text-muted hover:text-text"
            }
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<ArchiveFallback />}>
        <ArchiveView items={items} labels={labels} category={category} />
      </Suspense>
    </Container>
  );
}

async function MediaDetail({ slug }: { slug: string }) {
  const [item, all, labels, collections, categories] = await Promise.all([getMediaBySlug(slug), getAllMedia(), getLabelLookups(), getCollections(), getCategories()]);
  if (!item) notFound();
  const category = categories.find((c) => c.slug === item.category) ?? { slug: item.category, label: item.category, singular: item.category, description: "", order: 0 };
  const folder = await folderHref(item.folderId);
  const related = relatedMedia(item, all, 8);
  const tags = mediaTags(item, labels);
  const inCollections = collections.filter((c) => item.collections.includes(c.slug));
  const tier = resolutionTier(item.width, item.height);

  return (
    <Container className="pt-6">
      <Breadcrumbs
        items={[
          { href: "/media", label: "Media" },
          ...(folder ? folder.trail.map((t) => ({ href: t.href, label: t.name })) : [{ href: `/media/${item.category}`, label: category.label }]),
          { label: item.title },
        ]}
        className="mb-5"
      />
      <MediaStage item={item} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{category.singular}</Badge>
            {tier && <Badge tone="outline">{tier}</Badge>}
            {item.verification === "community" && <Badge tone="sample">Community made</Badge>}
          </div>
          <h1 className="display mt-3 text-[40px] sm:text-[54px]">{item.title}</h1>
          <p className="mt-2 text-[14px] text-muted">
            {item.source.label} · Published {formatDate(item.datePublished)}
          </p>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{item.description}</p>
          <div className="mt-6">
            <MediaActions item={item} />
          </div>

          <section aria-labelledby="tags-h" className="mt-10">
            <h2 id="tags-h" className="eyebrow mb-4">
              Related to
            </h2>
            <TagList tags={tags} />
          </section>

          {inCollections.length > 0 && (
            <section aria-labelledby="col-h" className="mt-10">
              <h2 id="col-h" className="eyebrow mb-3">
                Part of
              </h2>
              <ul className="flex flex-wrap gap-2">
                {inCollections.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/collections/${c.slug}`} className="block rounded-lg border border-border px-4 py-3 transition-colors hover:bg-surface">
                      <span className="block text-[14px] font-semibold">{c.title}</span>
                      <span className="text-[12.5px] text-muted">{pluralize(c.mediaSlugs.length, "item")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="meta-h" className="lg:pt-2">
          <h2 id="meta-h" className="eyebrow mb-2">
            Metadata
          </h2>
          <MetadataTable item={item} categoryLabel={category.singular} />
          {item.officialUrl && (
            <a href={item.officialUrl} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-text">
              Related Rockstar page <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-h">
          <SectionHeading id="related-h" title="Related media" description="Shares characters, locations or a release with this item." />
          <MediaGrid items={related} />
        </section>
      )}
    </Container>
  );
}
