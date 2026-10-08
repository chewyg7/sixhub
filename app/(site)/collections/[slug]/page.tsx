import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, ScanSearch } from "lucide-react";
import { Container, Breadcrumbs } from "@/components/layout/page";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { MediaGrid } from "@/components/media/media-grid";
import { viewerHref } from "@/components/media/media-links";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { getCollection, getCollections, getMediaBySlugs, getTimeline, getLabelLookups } from "@/lib/content";
import { formatDate, pluralize } from "@/lib/format";

export async function generateStaticParams() {
  return (await getCollections()).map((c) => ({ slug: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  return c ? { title: c.title, description: c.description, alternates: { canonical: `/collections/${c.slug}` } } : {};
}

export default async function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c) notFound();
  const [items, timeline, labels] = await Promise.all([getMediaBySlugs(c.mediaSlugs), getTimeline(), getLabelLookups()]);
  const cover = items.find((m) => m.slug === c.coverSlug) ?? items[0];
  const event = timeline.find((e) => e.id === c.timelineEventId);
  const firstVideo = items.find((m) => m.kind === "video");
  const characters = [...new Set(items.flatMap((m) => m.characters))];
  const locations = [...new Set(items.flatMap((m) => m.locations))];
  const kinds = {
    image: items.filter((m) => m.kind === "image").length,
    video: items.filter((m) => m.kind === "video").length,
    audio: items.filter((m) => m.kind === "audio").length,
  };

  return (
    <>
      <div className="relative">
        {cover && (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <ResponsiveImage item={cover} sizes="100vw" priority className="opacity-35 blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/80 to-bg" />
          </div>
        )}
        <Container className="pt-8 pb-10 sm:pt-12">
          <Breadcrumbs items={[{ href: "/collections", label: "Collections" }, { label: c.title }]} />
          <div className="mt-10 max-w-3xl">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{c.kind === "release" ? "Release" : "Curated"}</Badge>
              {items.some((m) => m.verification === "community") && <Badge tone="sample">Includes community-made items</Badge>}
            </div>
            <h1 className="display-tight mt-4 text-[56px] sm:text-[84px]">{c.title}</h1>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">{c.description}</p>
            <p className="tabular mt-4 text-[13px] text-muted">
              {[
                c.date && formatDate(c.date),
                kinds.image && pluralize(kinds.image, "image"),
                kinds.video && pluralize(kinds.video, "video"),
                kinds.audio && pluralize(kinds.audio, "audio file", "audio files"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {firstVideo && (
                <Link href={viewerHref(firstVideo.slug)} className={buttonClass({ variant: "primary" })}>
                  <ScanSearch /> Analyze {firstVideo.title}
                </Link>
              )}
              {event && (
                <Link href={`/timeline#${event.id}`} className={buttonClass({ variant: "secondary" })}>
                  <CalendarDays /> On the timeline
                </Link>
              )}
              {c.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener" className={buttonClass({ variant: "ghost" })}>
                  {s.label} <ArrowUpRight />
                </a>
              ))}
            </div>
            {(characters.length > 0 || locations.length > 0) && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {characters.map((s) => (
                  <Link
                    key={s}
                    href={`/info/characters/${s}`}
                    className="inline-flex h-7 items-center rounded-md border border-border bg-bg/40 px-2.5 text-[12.5px] hover:bg-surface-hover"
                  >
                    {labels.characters[s] ?? s}
                  </Link>
                ))}
                {locations.map((s) => (
                  <Link
                    key={s}
                    href={`/info/locations/${s}`}
                    className="inline-flex h-7 items-center rounded-md border border-border bg-bg/40 px-2.5 text-[12.5px] text-muted hover:bg-surface-hover hover:text-text"
                  >
                    {labels.locations[s] ?? s}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Container>
      </div>
      <Container>
        <MediaGrid items={items} columns={3} />
      </Container>
    </>
  );
}
