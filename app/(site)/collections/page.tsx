import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/layout/page";
import { MediaThumb } from "@/components/media/media-thumb";
import { getAllMedia, getCollections } from "@/lib/content";
import { formatDate, pluralize } from "@/lib/format";
import type { Collection, MediaItem } from "@/types/content";

export const metadata: Metadata = {
  title: "Collections",
  description: "GTA VI media grouped by release — trailers, screenshot drops and artwork sets.",
  alternates: { canonical: "/collections" },
};

function CollectionGrid({ list, bySlug }: { list: Collection[]; bySlug: Map<string, MediaItem> }) {
  return (
    <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => {
        const cover = bySlug.get(c.coverSlug);
        const strip = c.mediaSlugs
          .slice(1, 4)
          .map((s) => bySlug.get(s))
          .filter(Boolean);
        return (
          <Link key={c.slug} href={`/collections/${c.slug}`} className="group block">
            <div className="relative">
              {cover && <MediaThumb item={cover} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" aspect="16 / 10" showKind={false} rounded="rounded-xl" />}
              {strip.length > 0 && (
                <div className="absolute right-3 bottom-3 flex gap-1.5">
                  {strip.map((m) => (
                    <MediaThumb key={m!.slug} item={m!} sizes="80px" aspect="16 / 10" className="w-16 ring-1 ring-black/40" rounded="rounded-md" showKind={false} />
                  ))}
                </div>
              )}
            </div>
            <p className="mt-3 text-[17px] font-semibold group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">{c.title}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {pluralize(c.mediaSlugs.length, "item")}
              {c.date && ` · ${formatDate(c.date)}`}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

export default async function CollectionsPage() {
  const [collections, media] = await Promise.all([getCollections(), getAllMedia()]);
  const bySlug = new Map(media.map((m) => [m.slug, m]));
  const releases = collections.filter((c) => c.kind === "release").sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const curated = collections.filter((c) => c.kind === "curated");

  return (
    <Container>
      <PageHeader
        crumbs={[{ href: "/media", label: "Media" }, { label: "Collections" }]}
        title="Collections"
        lede="Everything connected to a release in one place: the trailer, its frames, and the assets published with it."
      />
      <h2 className="eyebrow mb-5">Releases</h2>
      <CollectionGrid list={releases} bySlug={bySlug} />
      <h2 className="eyebrow mt-16 mb-5">Curated sets</h2>
      <CollectionGrid list={curated} bySlug={bySlug} />
    </Container>
  );
}
