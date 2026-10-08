import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users";
import { getMediaRow, listCategories, listFolders, listInfoEntries, listSources } from "@/lib/db/content";
import { folderOptions } from "@/lib/admin/folders";
import { smallestVariant } from "@/lib/media/variants";
import { Badge, Notice, PageTitle } from "@/components/admin/ui";
import { MediaEditForm } from "@/components/admin/media-edit-form";
import { formatTime } from "@/components/admin/format";

export const metadata: Metadata = { title: "Edit media" };

export default async function EditMediaPage({ params, searchParams }: PageProps<"/chewy/media/[slug]">) {
  const user = await requireUserPage();
  const { slug } = await params;
  const sp = await searchParams;
  const row = getMediaRow(slug);
  if (!row) notFound();
  const { item } = row;
  const canEdit = user.role === "owner" || (row.createdBy === user.id && row.status === "pending");
  const entries = listInfoEntries();
  const creator = row.createdBy ? getUserById(row.createdBy) : null;
  const preview = smallestVariant(item, 1280)?.url;

  return (
    <>
      <Link href="/chewy/media" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-white/55 hover:text-white">
        <ArrowLeft className="size-4" /> All media
      </Link>
      <PageTitle
        title={item.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={row.status === "pending" ? "warn" : row.hidden ? "neutral" : "good"}>{row.status === "pending" ? "Awaiting review" : row.hidden ? "Hidden" : "Live"}</Badge>
            <span>
              {item.kind} · added {formatTime(Date.parse(item.dateAdded))}
              {creator ? ` by @${creator.username}` : ""}
            </span>
          </span>
        }
        actions={
          row.status === "published" &&
          !row.hidden && (
            <Link href={`/media/${item.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-[14px] font-bold text-white hover:bg-white/15">
              <ExternalLink className="size-4" /> View on site
            </Link>
          )
        }
      />
      {sp.saved && <Notice tone="success">Saved.</Notice>}
      {!canEdit && <Notice>Only owners can edit this item. Your own uploads stay editable until an owner reviews them.</Notice>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <MediaEditForm
          slug={item.slug}
          canEdit={canEdit}
          owner={user.role === "owner"}
          values={{
            title: item.title,
            slug: item.slug,
            description: item.description,
            alt: item.alt,
            category: item.category,
            folderId: item.folderId ?? "",
            sourceSlug: item.sourceSlug,
            datePublished: item.datePublished.slice(0, 10),
            tags: item.tags.join(", "),
            characters: item.characters,
            locations: item.locations,
            credit: item.credit ?? "",
            officialUrl: item.officialUrl ?? "",
            verification: item.verification,
            downloadable: item.downloadable,
            hidden: row.hidden,
            font: item.kind === "font" && item.font ? { family: item.font.family, style: item.font.style } : undefined,
          }}
          folders={folderOptions(listFolders())}
          categories={listCategories().map((c) => ({ slug: c.slug, label: c.label }))}
          sources={listSources().map((s) => ({ slug: s.slug, label: s.label }))}
          characters={entries.filter((e) => e.section === "characters").map((e) => ({ slug: e.slug, name: e.name }))}
          locations={entries.filter((e) => e.section === "locations").map((e) => ({ slug: e.slug, name: e.name }))}
        />

        <aside className="grid content-start gap-4">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30" style={{ backgroundColor: item.dominantColor ?? undefined }}>
            {item.kind === "video" && !item.original.url.startsWith("/") ? (
              <video src={item.renditions?.at(-1)?.url ?? item.original.url} poster={preview} controls preload="none" className="aspect-video w-full" />
            ) : item.kind === "video" || item.kind === "audio" ? (
              <video src={item.original.url} poster={preview} controls preload="none" className="aspect-video w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview
              <img src={preview} alt="" className={item.original.hasAlpha ? "w-full object-contain p-6" : "w-full"} />
            )}
          </div>
          <dl className="grid gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-[13.5px]">
            {[
              ["Slug", item.slug],
              ["File", item.original.filename],
              ["Type", item.original.mimeType],
              ["Size", item.original.bytes ? `${(item.original.bytes / 1024 / 1024).toFixed(2)} MB` : "Remote"],
              ["Dimensions", item.width ? `${item.width} × ${item.height}` : "—"],
              ["Duration", item.video ? `${item.video.duration.toFixed(1)} s · ${item.video.fps} fps` : item.audio ? `${item.audio.duration.toFixed(1)} s` : "—"],
              ["Origin", row.originKey ?? "Uploaded"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-white/50">{k}</dt>
                <dd className="truncate text-right">{v}</dd>
              </div>
            ))}
            <a href={item.original.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-bold text-accent-text">
              Open original <ExternalLink className="size-3.5" />
            </a>
          </dl>
        </aside>
      </div>
    </>
  );
}
