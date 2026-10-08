import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listCategories, listFolders } from "@/lib/db/content";
import { folderOptions } from "@/lib/admin/folders";
import { currentJob, listRuns } from "@/lib/grabber/gtavice";
import { PageTitle } from "@/components/admin/ui";
import { GrabberPanel } from "@/components/admin/grabber-panel";

export const metadata: Metadata = { title: "GTAVice grabber" };

export default async function GrabberPage() {
  await requireOwnerPage();
  return (
    <>
      <PageTitle title="GTAVice grabber" description="Checks every gallery on gtavice.net and lists only the images this archive doesn't have yet. Pick what to import and where it goes." />
      <GrabberPanel
        folders={folderOptions(listFolders())}
        categories={listCategories().map((c) => ({ slug: c.slug, label: c.label }))}
        runs={listRuns(8)}
        running={currentJob()?.status === "running" ? currentJob()!.id : null}
      />
    </>
  );
}
