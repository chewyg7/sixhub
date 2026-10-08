import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users";
import { listFolders, listMediaRows } from "@/lib/db/content";
import { folderOptions } from "@/lib/admin/folders";
import { smallestVariant } from "@/lib/media/variants";
import { Empty, PageTitle } from "@/components/admin/ui";
import { ReviewList } from "@/components/admin/review-list";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await requireOwnerPage();
  const folderName = new Map(folderOptions(listFolders()).map((f) => [f.id, f.label]));
  const pending = listMediaRows({ all: true })
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((r) => ({
      slug: r.item.slug,
      title: r.item.title,
      kind: r.item.kind,
      folder: folderName.get(r.item.folderId ?? "") ?? "No folder",
      by: r.createdBy ? (getUserById(r.createdBy)?.username ?? "deleted user") : "unknown",
      at: r.updatedAt,
      thumb: smallestVariant(r.item, 640)?.url ?? null,
    }));
  return (
    <>
      <PageTitle title="Review queue" description="Uploads from admins wait here until an owner approves them. Approved items go live immediately." />
      {pending.length ? <ReviewList items={pending} /> : <Empty title="All caught up.">Nothing is waiting for review.</Empty>}
    </>
  );
}
