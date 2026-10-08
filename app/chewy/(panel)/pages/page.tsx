import type { Metadata } from "next";
import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth/session";
import { listPages } from "@/lib/db/extras";
import { Badge, Card, Empty, PageTitle, formatTime } from "@/components/admin/ui";
import { NewPageForm } from "@/components/admin/page-editor";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage() {
  await requireOwnerPage();
  const pages = listPages();
  return (
    <>
      <PageTitle title="Pages" description="Write your own pages (rules, guides, giveaways…) with simple formatting. Published pages live at /p/<name>." />
      <Card title="New page" className="mb-6">
        <NewPageForm />
      </Card>
      {pages.length ? (
        <Card>
          <ul className="divide-y divide-white/8">
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={`/chewy/pages/${p.slug}`} className="flex flex-wrap items-center gap-3 py-3 hover:text-accent-text">
                  <span className="flex-1 text-[15px] font-bold">{p.title}</span>
                  <span className="font-mono text-[13px] text-white/45">/p/{p.slug}</span>
                  <Badge tone={p.published ? "good" : "warn"}>{p.published ? "Live" : "Draft"}</Badge>
                  <span className="text-[12.5px] text-white/40">
                    {formatTime(p.updatedAt)}
                    {p.updatedBy && ` · @${p.updatedBy}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty title="No pages yet">Create one above.</Empty>
      )}
    </>
  );
}
