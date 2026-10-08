import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listCategories, listCollections, listMediaRows, listSources, listTags, listTimeline } from "@/lib/db/content";
import { PageTitle } from "@/components/admin/ui";
import { RecordList } from "@/components/admin/record-list";
import { deleteCategory, deleteCollection, deleteSource, deleteTag, saveCategory, saveCollection, saveSource, saveTag } from "./actions";

export const metadata: Metadata = { title: "Tags & categories" };

export default async function TaxonomyPage() {
  await requireOwnerPage();
  const media = listMediaRows({ all: true });
  const tagCounts = new Map<string, number>();
  for (const r of media) for (const t of r.item.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  for (const t of listTags()) if (!tagCounts.has(t.label)) tagCounts.set(t.label, 0);
  const catCounts = new Map<string, number>();
  for (const r of media) catCounts.set(r.item.category, (catCounts.get(r.item.category) ?? 0) + 1);
  const srcCounts = new Map<string, number>();
  for (const r of media) srcCounts.set(r.item.sourceSlug, (srcCounts.get(r.item.sourceSlug) ?? 0) + 1);
  const events = listTimeline();

  return (
    <>
      <PageTitle title="Tags & categories" description="Everything used to label and group media. Changes apply to the whole site immediately." />
      <div className="grid gap-6">
        <RecordList
          title="Categories"
          description="Each category gets its own archive page at /media/<slug>."
          newLabel="New category"
          items={listCategories().map((c) => ({
            key: c.slug,
            title: c.label,
            subtitle: `/media/${c.slug} · ${catCounts.get(c.slug) ?? 0} items`,
            values: { slug: c.slug, label: c.label, singular: c.singular, description: c.description, order: String(c.order) },
          }))}
          fields={[
            { name: "label", label: "Name", required: true },
            { name: "singular", label: "Singular", hint: "e.g. “Screenshot”" },
            { name: "slug", label: "URL slug", createOnly: true, hint: "Left empty, it's made from the name." },
            { name: "order", label: "Order", type: "number" },
            { name: "description", label: "Description", type: "textarea", rows: 2 },
          ]}
          save={saveCategory}
          remove={deleteCategory}
        />

        <RecordList
          title="Tags"
          description="Renaming a tag updates every item that has it."
          newLabel="New tag"
          items={[...tagCounts]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([label, n]) => ({ key: label, title: label, subtitle: `${n} item${n === 1 ? "" : "s"}`, values: { label } }))}
          fields={[{ name: "label", label: "Tag", required: true }]}
          save={saveTag}
          remove={deleteTag}
        />

        <RecordList
          title="Sources"
          description="Where media comes from, shown on every item."
          newLabel="New source"
          items={listSources().map((s) => ({
            key: s.slug,
            title: s.label,
            subtitle: `${s.origin}${s.date ? ` · ${s.date}` : ""} · ${srcCounts.get(s.slug) ?? 0} items`,
            values: { slug: s.slug, label: s.label, origin: s.origin, url: s.url ?? "", date: s.date ?? "" },
          }))}
          fields={[
            { name: "label", label: "Name", required: true },
            { name: "slug", label: "Slug", createOnly: true },
            {
              name: "origin",
              label: "Kind",
              type: "select",
              options: ["trailer", "newswire", "website", "social", "press", "other"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
            },
            { name: "date", label: "Date", type: "date" },
            { name: "url", label: "Link", type: "url", wide: true },
          ]}
          blank={{ origin: "website" }}
          save={saveSource}
          remove={deleteSource}
        />

        <RecordList
          title="Collections"
          description="Curated sets and release batches, each with its own page at /collections/<slug>."
          newLabel="New collection"
          items={listCollections().map((c) => ({
            key: c.slug,
            title: c.title,
            badge: c.kind === "release" ? "Release" : "Curated",
            subtitle: `${c.mediaSlugs.length} items${c.date ? ` · ${c.date}` : ""}`,
            values: {
              slug: c.slug,
              title: c.title,
              kind: c.kind,
              description: c.description,
              date: c.date ?? "",
              coverSlug: c.coverSlug,
              mediaSlugs: c.mediaSlugs.join("\n"),
              sources: c.sources.map((s) => `${s.label} | ${s.url}`).join("\n"),
              timelineEventId: c.timelineEventId ?? "",
            },
          }))}
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "slug", label: "Slug", createOnly: true },
            {
              name: "kind",
              label: "Kind",
              type: "select",
              options: [
                { value: "release", label: "Release (an official drop)" },
                { value: "curated", label: "Curated (hand-picked)" },
              ],
            },
            { name: "date", label: "Date", type: "date" },
            { name: "description", label: "Description", type: "textarea", rows: 3 },
            { name: "coverSlug", label: "Cover (media slug)", hint: "Defaults to the first item." },
            { name: "timelineEventId", label: "Timeline event", type: "select", options: [{ value: "", label: "(None)" }, ...events.map((e) => ({ value: e.id, label: `${e.date} · ${e.title}` }))] },
            { name: "mediaSlugs", label: "Media (one slug per line, in order)", type: "code", rows: 8 },
            { name: "sources", label: "Sources (Label | https://… per line)", type: "code", rows: 3 },
          ]}
          blank={{ kind: "curated" }}
          save={saveCollection}
          remove={deleteCollection}
        />
      </div>
    </>
  );
}
