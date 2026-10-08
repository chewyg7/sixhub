import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnerPage } from "@/lib/auth/session";
import { getPage } from "@/lib/db/extras";
import { PageTitle } from "@/components/admin/ui";
import { PageEditor } from "@/components/admin/page-editor";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/chewy/pages/[slug]">) {
  await requireOwnerPage();
  const page = getPage((await params).slug);
  if (!page) notFound();
  return (
    <>
      <PageTitle
        kicker={
          <Link href="/chewy/pages" className="hover:text-white">
            ← Pages
          </Link>
        }
        title={page.title}
      />
      <PageEditor page={page} />
    </>
  );
}
