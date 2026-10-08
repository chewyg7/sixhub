import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { getSettings, listCollections, listMediaRows } from "@/lib/db/content";
import { PageTitle } from "@/components/admin/ui";
import { SettingsForms } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "Site settings" };

export default async function SettingsPage() {
  await requireOwnerPage();
  const videos = listMediaRows({ all: true })
    .filter((r) => r.item.kind === "video")
    .map((r) => ({ value: r.item.slug, label: r.item.title }));
  return (
    <>
      <PageTitle title="Site settings" description="Changes apply to the live site immediately." />
      <SettingsForms settings={getSettings()} videos={videos} collections={listCollections().map((c) => ({ value: c.slug, label: c.title }))} />
    </>
  );
}
