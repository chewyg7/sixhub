import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listFolders, listMediaRows } from "@/lib/db/content";
import { folderOptions } from "@/lib/admin/folders";
import { PageTitle } from "@/components/admin/ui";
import { FolderManager, type FolderRow } from "@/components/admin/folder-manager";

export const metadata: Metadata = { title: "Folders" };

export default async function FoldersPage() {
  await requireOwnerPage();
  const folders = listFolders();
  const counts = new Map<string, number>();
  for (const r of listMediaRows({ all: true })) counts.set(r.item.folderId ?? "", (counts.get(r.item.folderId ?? "") ?? 0) + 1);
  const rows: FolderRow[] = folders.map((f) => ({ ...f, coverSlug: f.coverSlug ?? "", items: counts.get(f.id) ?? 0 }));
  return (
    <>
      <PageTitle title="Folders" description="How the media archive is organised. Empty folders stay hidden on the site until something is filed in them." />
      <FolderManager rows={rows} options={folderOptions(folders)} unfiled={counts.get("") ?? 0} />
    </>
  );
}
