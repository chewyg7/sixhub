import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listBackups, systemStats } from "@/lib/admin/system";
import { PageTitle } from "@/components/admin/ui";
import { SystemPanel } from "@/components/admin/system-panel";

export const metadata: Metadata = { title: "System & backups" };

export default async function SystemPage() {
  await requireOwnerPage();
  const [stats, backupList] = await Promise.all([systemStats(), listBackups()]);
  return (
    <>
      <PageTitle title="System & backups" description="Storage, health checks, backups and exports." />
      <SystemPanel data={{ ...stats, backupList }} />
    </>
  );
}
