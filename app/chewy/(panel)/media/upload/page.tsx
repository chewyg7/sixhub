import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth/session";
import { listCategories, listFolders, listInfoEntries, listSources } from "@/lib/db/content";
import { folderOptions } from "@/lib/admin/folders";
import { PageTitle, Notice } from "@/components/admin/ui";
import { Uploader } from "@/components/admin/uploader";
import { RemoteVideoForm } from "@/components/admin/remote-video-form";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage() {
  const user = await requireUserPage();
  const entries = listInfoEntries();
  const shared = {
    folders: folderOptions(listFolders()),
    categories: listCategories().map((c) => ({ slug: c.slug, label: c.label })),
    sources: listSources().map((s) => ({ slug: s.slug, label: s.label })),
  };
  return (
    <>
      <PageTitle title="Upload" description="Images, videos, audio and fonts. Files are checked, converted for the web and filed into the folder you choose." />
      {user.role === "admin" && <Notice>Your uploads go to the review queue. An owner approves them before they appear on the site.</Notice>}
      <div className="mt-6 grid gap-6">
        <Uploader
          {...shared}
          owner={user.role === "owner"}
          characters={entries.filter((e) => e.section === "characters").map((e) => ({ slug: e.slug, name: e.name }))}
          locations={entries.filter((e) => e.section === "locations").map((e) => ({ slug: e.slug, name: e.name }))}
        />
        {user.role === "owner" && <RemoteVideoForm {...shared} />}
      </div>
    </>
  );
}
