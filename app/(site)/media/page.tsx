import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/layout/page";
import { ArchiveFallback } from "@/features/archive/archive-fallback";
import { ArchiveView } from "@/features/archive/archive-view";
import { getAllMedia, getLabelLookups } from "@/lib/content";
import { MEDIA_SOURCES } from "@/data/sources";
import { pluralize } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Media Archive",
  description: "Search and filter every GTA VI screenshot, trailer, artwork, logo, audio track and promotional asset.",
  alternates: { canonical: "/media" },
};

export default async function MediaArchivePage() {
  const [items, lookups] = await Promise.all([getAllMedia(), getLabelLookups()]);
  const labels = { characters: lookups.characters, locations: lookups.locations, sources: Object.fromEntries(MEDIA_SOURCES.map((s) => [s.slug, s.label])) };
  return (
    <Container>
      <PageHeader
        eyebrow={pluralize(items.length, "asset")}
        title="Media archive"
        lede="Screenshots, trailers, artwork, audio and campaign material, with full metadata. Filter by character, location, source or resolution."
        actions={
          <ButtonLink href="/collections" variant="outline">
            Browse collections
          </ButtonLink>
        }
      />
      <Suspense fallback={<ArchiveFallback />}>
        <ArchiveView items={items} labels={labels} />
      </Suspense>
    </Container>
  );
}
