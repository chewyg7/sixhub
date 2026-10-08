import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageHeader, SectionHeading } from "@/components/layout/page";
import { ArchiveFallback } from "@/features/archive/archive-fallback";
import { ArchiveView } from "@/features/archive/archive-view";
import { FolderGrid } from "@/components/media/folder-grid";
import { getAllMedia, getFolderTree, getLabelLookups, getSources, toFolderCards } from "@/lib/content";
import { pluralize } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Media Archive",
  description: "Browse folders of every official GTA VI screenshot, screengrab, artwork, trailer, logo and font, or search and filter the whole archive.",
  alternates: { canonical: "/media" },
};

export default async function MediaArchivePage() {
  const [items, lookups, sources, tree] = await Promise.all([getAllMedia(), getLabelLookups(), getSources(), getFolderTree()]);
  const labels = { characters: lookups.characters, locations: lookups.locations, sources: Object.fromEntries(sources.map((s) => [s.slug, s.label])) };
  const folders = await toFolderCards(tree);
  return (
    <Container>
      <PageHeader
        eyebrow={pluralize(items.length, "asset")}
        title="Media archive"
        lede="Every official screenshot, screengrab, artwork, trailer, logo and font, sorted into folders, with full metadata."
        actions={
          <ButtonLink href="/collections" variant="outline">
            Browse collections
          </ButtonLink>
        }
      />
      <section aria-labelledby="folders-h">
        <h2 id="folders-h" className="sr-only">
          Folders
        </h2>
        <FolderGrid folders={folders} />
      </section>
      <section aria-labelledby="all-h" className="mt-24">
        <SectionHeading id="all-h" kicker="Search everything" title="All media" />
        <Suspense fallback={<ArchiveFallback />}>
          <ArchiveView items={items} labels={labels} />
        </Suspense>
      </section>
    </Container>
  );
}
