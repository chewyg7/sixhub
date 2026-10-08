import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/session";
import { listCollections, listFaq, listInfoEntries, listInfoSections, listTimeline } from "@/lib/db/content";
import { blocksToText, factsToText } from "@/lib/admin/blocks";
import { PageTitle } from "@/components/admin/ui";
import { RecordList } from "@/components/admin/record-list";
import { deleteEntry, deleteEvent, deleteFaq, deleteSection, saveEntry, saveEvent, saveFaq, saveSection } from "./actions";

export const metadata: Metadata = { title: "Content" };

const VERIFY = [
  { value: "official", label: "Official (Rockstar)" },
  { value: "reported", label: "Reported (press)" },
  { value: "community", label: "Community" },
];
const links = (s: { label: string; url: string }[]) => s.map((x) => `${x.label} | ${x.url}`).join("\n");

export default async function ContentPage() {
  await requireOwnerPage();
  const sections = listInfoSections();
  const sectionOptions = sections.map((s) => ({ value: s.slug, label: s.title }));
  const collections = listCollections();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageTitle title="Content" description="The Leonida database, the timeline and the FAQ." />
      <div className="grid gap-6">
        <RecordList
          title="FAQ"
          description="Questions on /faq. “Featured” ones also appear at the bottom of the home page."
          newLabel="New question"
          items={listFaq().map((f) => ({
            key: f.id,
            title: f.question,
            badge: !f.published ? "Draft" : f.featured ? "Featured" : undefined,
            subtitle: `${f.group} · order ${f.sort}`,
            values: { question: f.question, answer: f.answer, group: f.group, sort: String(f.sort), published: f.published, featured: f.featured },
          }))}
          fields={[
            { name: "question", label: "Question", required: true, wide: true },
            { name: "answer", label: "Answer", type: "textarea", rows: 6, hint: "Blank lines start a new paragraph." },
            { name: "group", label: "Group", placeholder: "The game" },
            { name: "sort", label: "Order", type: "number" },
            { name: "published", label: "Published", type: "toggle", placeholder: "Show on the site" },
            { name: "featured", label: "Featured", type: "toggle", placeholder: "Also show on the home page" },
          ]}
          blank={{ published: true, featured: false, group: "The game", sort: "100" }}
          save={saveFaq}
          remove={deleteFaq}
        />

        <RecordList
          title="Database entries"
          description="Characters, locations and everything else in the Leonida database."
          newLabel="New entry"
          items={listInfoEntries().map((e) => ({
            key: e.id,
            title: e.name,
            badge: sections.find((s) => s.slug === e.section)?.title,
            subtitle: `/info/${e.section}/${e.slug}`,
            values: {
              section: e.section,
              name: e.name,
              slug: e.slug,
              subtitle: e.subtitle ?? "",
              summary: e.summary,
              imageSlug: e.imageSlug ?? "",
              body: blocksToText(e.body),
              facts: factsToText(e.facts),
              relatedCharacters: e.relatedCharacters.join(", "),
              relatedLocations: e.relatedLocations.join(", "),
              relatedCollections: e.relatedCollections.join(", "),
              newsQuery: e.newsQuery ?? "",
              sources: links(e.sources),
              verification: e.verification,
              lastReviewed: e.lastReviewed,
            },
          }))}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "section", label: "Section", type: "select", options: sectionOptions },
            { name: "slug", label: "URL slug", hint: "Left empty, it's made from the name." },
            { name: "subtitle", label: "Subtitle", placeholder: "Protagonist" },
            { name: "summary", label: "Summary", type: "textarea", rows: 3 },
            { name: "body", label: "Body", type: "code", rows: 10, hint: "Blank line = new paragraph. Lines starting “- ” are a list. “> ” is a note." },
            { name: "facts", label: "Facts (Label: value per line)", type: "code", rows: 4 },
            { name: "imageSlug", label: "Portrait (media slug)" },
            { name: "newsQuery", label: "Related news search" },
            { name: "relatedCharacters", label: "Related characters (slugs, comma separated)", wide: true },
            { name: "relatedLocations", label: "Related locations (slugs, comma separated)", wide: true },
            { name: "relatedCollections", label: "Related collections (slugs, comma separated)", wide: true },
            { name: "sources", label: "Sources (Label | https://… per line)", type: "code", rows: 3 },
            { name: "verification", label: "Trust level", type: "select", options: VERIFY },
            { name: "lastReviewed", label: "Last reviewed", type: "date" },
          ]}
          blank={{ section: sections[0]?.slug ?? "", verification: "official", lastReviewed: today }}
          save={saveEntry}
          remove={deleteEntry}
        />

        <RecordList
          title="Timeline"
          description="Milestones on /timeline and the home page."
          newLabel="New event"
          items={[...listTimeline()].reverse().map((e) => ({
            key: e.id,
            title: e.title,
            badge: e.type,
            subtitle: e.date,
            values: {
              id: e.id,
              date: e.date,
              datePrecision: e.datePrecision,
              type: e.type,
              title: e.title,
              summary: e.summary,
              sources: links(e.sources),
              collectionSlug: e.collectionSlug ?? "",
              mediaSlugs: (e.mediaSlugs ?? []).join("\n"),
              newsQuery: e.newsQuery ?? "",
              verification: e.verification,
            },
          }))}
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "date", label: "Date", type: "date", required: true },
            {
              name: "datePrecision",
              label: "Date precision",
              type: "select",
              options: [
                { value: "day", label: "Exact day" },
                { value: "month", label: "Month" },
                { value: "year", label: "Year" },
              ],
            },
            {
              name: "type",
              label: "Type",
              type: "select",
              options: ["announcement", "trailer", "screenshots", "newswire", "release-date", "marketing", "financial"].map((v) => ({ value: v, label: v })),
            },
            { name: "id", label: "ID", createOnly: true, hint: "Left empty, it's made from the date and title." },
            { name: "summary", label: "Summary", type: "textarea", rows: 3 },
            { name: "collectionSlug", label: "Collection", type: "select", options: [{ value: "", label: "(None)" }, ...collections.map((c) => ({ value: c.slug, label: c.title }))] },
            { name: "newsQuery", label: "Related news search" },
            { name: "mediaSlugs", label: "Media (one slug per line)", type: "code", rows: 3 },
            { name: "sources", label: "Sources (Label | https://… per line)", type: "code", rows: 3 },
            { name: "verification", label: "Trust level", type: "select", options: VERIFY },
          ]}
          blank={{ datePrecision: "day", type: "announcement", verification: "official", date: today }}
          save={saveEvent}
          remove={deleteEvent}
        />

        <RecordList
          title="Database sections"
          description="Top-level groups in the Leonida database, each at /info/<slug>."
          newLabel="New section"
          searchable={false}
          items={sections.map((s) => ({
            key: s.slug,
            title: s.title,
            subtitle: `/info/${s.slug} · ${s.layout}`,
            values: { slug: s.slug, title: s.title, description: s.description, layout: s.layout, entryNoun: s.entryNoun, newsQuery: s.newsQuery ?? "", order: String(s.order) },
          }))}
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "slug", label: "Slug", createOnly: true },
            {
              name: "layout",
              label: "Layout",
              type: "select",
              options: [
                { value: "profiles", label: "Profiles (portrait cards)" },
                { value: "places", label: "Places (landscape cards)" },
                { value: "list", label: "List" },
              ],
            },
            { name: "entryNoun", label: "Entry noun", placeholder: "character" },
            { name: "order", label: "Order", type: "number" },
            { name: "newsQuery", label: "Related news search" },
            { name: "description", label: "Description", type: "textarea", rows: 2 },
          ]}
          blank={{ layout: "list", entryNoun: "entry", order: "100" }}
          save={saveSection}
          remove={deleteSection}
        />
      </div>
    </>
  );
}
