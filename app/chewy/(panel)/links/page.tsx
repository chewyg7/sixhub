import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listShortLinks } from "@/lib/db/extras";
import { SITE } from "@/lib/site";
import { PageTitle } from "@/components/admin/ui";
import { LinkManager } from "@/components/admin/link-manager";

export const metadata: Metadata = { title: "Short links" };

export default async function LinksPage() {
  await requireOwnerPage();
  return (
    <>
      <PageTitle title="Short links" description="Memorable /go/ links with click counts." />
      <LinkManager links={listShortLinks()} origin={SITE.url} />
    </>
  );
}
