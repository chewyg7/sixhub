import type { Metadata } from "next";
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listCategories, listFolders, listMediaRows } from "@/lib/db/content";
import { smallestVariant } from "@/lib/media/variants";
import { PageTitle, Notice } from "@/components/admin/ui";
import { MediaManager, type MediaRowLite } from "@/components/admin/media-manager";
import { folderOptions } from "@/lib/admin/folders";

export const metadata: Metadata = { title: "Media" };

export default async function AdminMediaPage({ searchParams }: PageProps<"/chewy/media">) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const rows: MediaRowLite[] = listMediaRows({ all: true })
    .sort((a, b) => b.item.dateAdded.localeCompare(a.item.dateAdded))
    .map((r) => ({
      slug: r.item.slug,
      title: r.item.title,
      kind: r.item.kind,
      category: r.item.category,
      folderId: r.item.folderId ?? "",
      status: r.status,
      hidden: r.hidden,
      mine: r.createdBy === user.id,
      thumb: smallestVariant(r.item, 320)?.url ?? null,
      color: r.item.dominantColor ?? null,
      dateAdded: r.item.dateAdded,
      tags: r.item.tags,
    }));
  return (
    <>
      <PageTitle
        title="Media"
        description={`${rows.length.toLocaleString("en-US")} items. Click one to edit it.`}
        actions={
          <Link href="/chewy/media/upload" className="inline-flex h-11 items-center gap-2 rounded-full bg-[image:var(--sunset)] px-5 text-[14px] font-bold text-white">
            <UploadCloud className="size-4" /> Upload
          </Link>
        }
      />
      {sp.deleted && <Notice tone="success">Deleted.</Notice>}
      <MediaManager rows={rows} folders={folderOptions(listFolders())} categories={listCategories().map((c) => ({ slug: c.slug, label: c.label }))} owner={user.role === "owner"} />
    </>
  );
}
