import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/db/content";
import { PageTitle } from "@/components/admin/ui";
import { SiteEditor } from "@/components/admin/site-editor";

export const metadata: Metadata = { title: "Site editor" };

export default async function SiteEditorPage() {
  await requireOwnerPage();
  return (
    <>
      <PageTitle
        title="Site editor"
        description="Arrange the home page and edit navigation, footer and search text. Saving updates the live site right away."
        actions={
          <Link href="/" target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold text-white hover:bg-white/15">
            <ExternalLink className="size-4" /> Open the site
          </Link>
        }
      />
      <SiteEditor site={getSettings().site} />
    </>
  );
}
