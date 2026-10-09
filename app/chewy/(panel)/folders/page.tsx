import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listFolders, listMediaRows } from "@/lib/db/content";
import { folderOptions } from "@/lib/admin/folders";
import { PageTitle } from "@/components/admin/ui";
import { FolderManager, type FolderItem, type FolderRow } from "@/components/admin/folder-manager";
import { smallestVariant } from "@/lib/media/variants";

export const metadata: Metadata = { title: "Folders" };

export default async function FoldersPage() {
  await requireOwnerPage();
  const folders = listFolders();
  const media = listMediaRows({ all: true });
  const counts = new Map<string, number>();
  for (const r of media) counts.set(r.item.folderId ?? "", (counts.get(r.item.folderId ?? "") ?? 0) + 1);
  const items: FolderItem[] = media
    .map((r) => ({ slug: r.item.slug, title: r.item.title, folderId: r.item.folderId ?? "", kind: r.item.kind, thumb: smallestVariant(r.item, 160)?.url ?? null, hidden: r.hidden || r.status !== "published" }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const rows: FolderRow[] = folders.map((f) => ({ ...f, coverSlug: f.coverSlug ?? "", items: counts.get(f.id) ?? 0 }));
  return (
    <>
      <PageTitle title="Folders" description="Drag folders and items to reorganise the archive. Empty folders stay hidden on the site until something is filed in them." />
      <FolderManager rows={rows} items={items} options={folderOptions(folders)} />
    </>
  );
}
