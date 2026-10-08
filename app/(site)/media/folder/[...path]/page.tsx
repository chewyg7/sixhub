import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/layout/page";
import { ArchiveFallback } from "@/features/archive/archive-fallback";
import { FolderGrid } from "@/components/media/folder-grid";
import { FolderContents } from "@/features/archive/folder-contents";
import { flattenTree, getFolderByPath, getFolderMedia, getFolderTree, getLabelLookups, getSources, toFolderCards } from "@/lib/content";
import { pluralize } from "@/lib/format";

export async function generateStaticParams() {
  return flattenTree(await getFolderTree()).map((f) => ({ path: f.path }));
}

// Folders created in the admin panel after the build render on first visit.
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps<"/media/folder/[...path]">): Promise<Metadata> {
  const { path } = await params;
  const found = await getFolderByPath(path);
  if (!found) return {};
  const { folder, trail } = found;
  return {
    title: trail.map((t) => t.name).join(" · "),
    description: folder.description || `${pluralize(folder.total, "official GTA VI media item")} in ${folder.name}.`,
    alternates: { canonical: `/media/folder/${path.join("/")}` },
  };
}

export default async function FolderPage({ params }: PageProps<"/media/folder/[...path]">) {
  const { path } = await params;
  const found = await getFolderByPath(path);
  if (!found) notFound();
  const { folder, trail } = found;
  const [direct, deep, lookups, sources, subfolders] = await Promise.all([
    getFolderMedia(folder, false),
    folder.children.length ? getFolderMedia(folder, true) : Promise.resolve([]),
    getLabelLookups(),
    getSources(),
    toFolderCards(folder.children),
  ]);
  const labels = { characters: lookups.characters, locations: lookups.locations, sources: Object.fromEntries(sources.map((s) => [s.slug, s.label])) };
  const eyebrow = [folder.children.length ? pluralize(folder.children.length, "folder") : null, pluralize(folder.total, "item")].filter(Boolean).join(" · ");

  return (
    <Container>
      <PageHeader
        crumbs={[{ href: "/media", label: "Media" }, ...trail.slice(0, -1).map((t) => ({ href: `/media/folder/${t.path.join("/")}`, label: t.name })), { label: folder.name }]}
        eyebrow={eyebrow}
        title={folder.name}
        lede={folder.description || undefined}
      />
      {subfolders.length > 0 && <FolderGrid folders={subfolders} />}
      {(direct.length > 0 || deep.length > 0) && (
        <section aria-label="Items" className={subfolders.length ? "mt-20" : undefined}>
          <Suspense fallback={<ArchiveFallback />}>
            <FolderContents direct={direct} deep={deep} labels={labels} />
          </Suspense>
        </section>
      )}
    </Container>
  );
}
