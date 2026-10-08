"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { bool, csv, isoDate, lines, run, slugField, sourceLines, str, type ActionState } from "@/lib/admin/action";
import { textToBlocks, textToFacts } from "@/lib/admin/blocks";
import * as repo from "@/lib/db/content";
import { slugify } from "@/lib/slug";
import type { InfoEntry, InfoSection, TimelineEvent } from "@/types/content";

const verification = z.enum(["official", "reported", "community"]);

/* Info sections ------------------------------------------------------- */

export async function saveSection(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const title = z.string().min(1).max(80).parse(str(f, "title"));
    const s: InfoSection = {
      slug: slugField.parse(key || str(f, "slug") || slugify(title)),
      title,
      description: z.string().max(400).parse(str(f, "description")),
      layout: z.enum(["profiles", "places", "list"]).parse(str(f, "layout")),
      entryNoun: z.string().min(1).max(40).parse(str(f, "entryNoun") || "entry"),
      newsQuery: str(f, "newsQuery") || undefined,
      order: z.coerce.number().int().min(0).max(1000).parse(str(f, "order") || "100"),
    };
    repo.saveInfoSection(s);
    await audit(user, key ? "section.edit" : "section.create", s.slug);
    return `Saved ${s.title}.`;
  });
}

export async function deleteSection(slug: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.deleteInfoSection(slug);
    await audit(user, "section.delete", slug);
    return "Deleted.";
  });
}

/* Info entries -------------------------------------------------------- */

export async function saveEntry(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const existing = key ? repo.listInfoEntries().find((e) => e.id === key) : undefined;
    const name = z.string().min(1).max(120).parse(str(f, "name"));
    const section = z.string().min(1).parse(str(f, "section"));
    if (!repo.listInfoSections().some((s) => s.slug === section)) throw new Error("Unknown section.");
    const e: InfoEntry = {
      id: existing?.id ?? randomUUID(),
      slug: slugField.parse(str(f, "slug") || slugify(name)),
      section,
      name,
      subtitle: str(f, "subtitle") || undefined,
      summary: z.string().max(1000).parse(str(f, "summary")),
      body: textToBlocks(z.string().max(20000).parse(str(f, "body"))),
      facts: textToFacts(str(f, "facts")),
      imageSlug: str(f, "imageSlug") || undefined,
      relatedCharacters: csv(f, "relatedCharacters"),
      relatedLocations: csv(f, "relatedLocations"),
      relatedCollections: csv(f, "relatedCollections"),
      newsQuery: str(f, "newsQuery") || undefined,
      sources: sourceLines(f, "sources"),
      verification: verification.parse(str(f, "verification")),
      lastReviewed: isoDate.parse(str(f, "lastReviewed") || new Date().toISOString().slice(0, 10)),
    };
    if (e.imageSlug && !repo.mediaSlugExists(e.imageSlug)) throw new Error("No media item has that image slug.");
    repo.saveInfoEntry(e);
    await audit(user, existing ? "entry.edit" : "entry.create", `${e.section}/${e.slug}`);
    return `Saved ${e.name}.`;
  });
}

export async function deleteEntry(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.deleteInfoEntry(id);
    await audit(user, "entry.delete", id);
    return "Deleted.";
  });
}

/* Timeline ------------------------------------------------------------ */

export async function saveEvent(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const title = z.string().min(1).max(160).parse(str(f, "title"));
    const date = isoDate.parse(str(f, "date"));
    const e: TimelineEvent = {
      id: key || slugField.parse(str(f, "id") || `${date}-${slugify(title, 40)}`),
      date,
      datePrecision: z.enum(["day", "month", "year"]).parse(str(f, "datePrecision")),
      type: z.enum(["announcement", "trailer", "screenshots", "newswire", "release-date", "marketing", "financial"]).parse(str(f, "type")),
      title,
      summary: z.string().max(1500).parse(str(f, "summary")),
      sources: sourceLines(f, "sources"),
      collectionSlug: str(f, "collectionSlug") || undefined,
      mediaSlugs: lines(f, "mediaSlugs"),
      newsQuery: str(f, "newsQuery") || undefined,
      verification: verification.parse(str(f, "verification")),
    };
    repo.saveTimelineEvent(e);
    await audit(user, key ? "timeline.edit" : "timeline.create", e.id);
    return `Saved ${e.title}.`;
  });
}

export async function deleteEvent(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.deleteTimelineEvent(id);
    await audit(user, "timeline.delete", id);
    return "Deleted.";
  });
}

/* FAQ ------------------------------------------------------------------ */

export async function saveFaq(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const question = z.string().min(1).max(240).parse(str(f, "question"));
    const entry = {
      id: key || slugField.parse(slugify(question, 48)),
      question,
      answer: z.string().min(1).max(6000).parse(str(f, "answer")),
      group: z.string().min(1).max(60).parse(str(f, "group") || "General"),
      sort: z.coerce.number().int().min(0).max(10_000).parse(str(f, "sort") || "100"),
      published: bool(f, "published"),
      featured: bool(f, "featured"),
    };
    if (!key && repo.listFaq().some((x) => x.id === entry.id)) entry.id = `${entry.id}-${Date.now().toString(36)}`;
    repo.saveFaq(entry);
    await audit(user, key ? "faq.edit" : "faq.create", entry.id);
    return "Saved.";
  });
}

export async function deleteFaq(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.deleteFaq(id);
    await audit(user, "faq.delete", id);
    return "Deleted.";
  });
}
