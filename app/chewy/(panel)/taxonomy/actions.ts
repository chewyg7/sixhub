"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { isoDate, lines, run, slugField, sourceLines, str, type ActionState } from "@/lib/admin/action";
import * as repo from "@/lib/db/content";
import { slugify } from "@/lib/slug";

/* Categories ---------------------------------------------------------- */

export async function saveCategory(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const label = z.string().min(1).max(60).parse(str(f, "label"));
    const c = {
      slug: slugField.parse(key || str(f, "slug") || slugify(label)),
      label,
      singular: z.string().min(1).max(60).parse(str(f, "singular") || label),
      description: z.string().max(400).parse(str(f, "description")),
      order: z.coerce.number().int().min(0).max(1000).parse(str(f, "order") || "100"),
    };
    if (!key && repo.listCategories().some((x) => x.slug === c.slug)) throw new Error("A category with that slug exists.");
    repo.saveCategory(c);
    await audit(user, key ? "category.edit" : "category.create", c.slug);
    return `Saved ${c.label}.`;
  });
}

export async function deleteCategory(slug: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const rest = repo.listCategories().filter((c) => c.slug !== slug);
    if (!rest.length) throw new Error("Keep at least one category.");
    repo.deleteCategory(slug, rest[0].slug);
    await audit(user, "category.delete", slug, { movedTo: rest[0].slug });
    return `Deleted. Its items moved to ${rest[0].label}.`;
  });
}

/* Tags ---------------------------------------------------------------- */

export async function saveTag(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const from = str(f, "_key");
    const label = z.string().min(1).max(64).parse(str(f, "label"));
    if (from && from !== label) repo.retag(from, label);
    repo.saveTag({ slug: slugify(label), label });
    await audit(user, from ? "tag.rename" : "tag.create", label, from ? { from } : undefined);
    return from && from !== label ? `Renamed “${from}” to “${label}” everywhere.` : `Saved “${label}”.`;
  });
}

export async function deleteTag(label: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.retag(label, null);
    await audit(user, "tag.delete", label);
    return `Removed “${label}” from every item.`;
  });
}

/* Sources ------------------------------------------------------------- */

export async function saveSource(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const label = z.string().min(1).max(80).parse(str(f, "label"));
    const s = {
      slug: slugField.parse(key || str(f, "slug") || slugify(label)),
      label,
      origin: z.enum(["trailer", "newswire", "website", "social", "press", "other"]).parse(str(f, "origin")),
      url: str(f, "url") ? z.string().url().max(500).parse(str(f, "url")) : undefined,
      date: str(f, "date") ? isoDate.parse(str(f, "date")) : undefined,
    };
    repo.saveSource(s);
    await audit(user, key ? "source.edit" : "source.create", s.slug);
    return `Saved ${s.label}.`;
  });
}

export async function deleteSource(slug: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.deleteSource(slug);
    await audit(user, "source.delete", slug);
    return "Deleted.";
  });
}

/* Collections --------------------------------------------------------- */

export async function saveCollection(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const key = str(f, "_key");
    const title = z.string().min(1).max(120).parse(str(f, "title"));
    const mediaSlugs = lines(f, "mediaSlugs");
    const missing = mediaSlugs.filter((s) => !repo.mediaSlugExists(s));
    if (missing.length) throw new Error(`These media slugs don't exist: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);
    const c = {
      slug: slugField.parse(key || str(f, "slug") || slugify(title)),
      title,
      kind: z.enum(["release", "curated"]).parse(str(f, "kind")),
      description: z.string().max(1000).parse(str(f, "description")),
      date: str(f, "date") ? isoDate.parse(str(f, "date")) : undefined,
      coverSlug: str(f, "coverSlug") || mediaSlugs[0] || "",
      mediaSlugs,
      sources: sourceLines(f, "sources"),
      timelineEventId: str(f, "timelineEventId") || undefined,
    };
    if (!key && repo.listCollections().some((x) => x.slug === c.slug)) throw new Error("A collection with that slug exists.");
    repo.saveCollection(c);
    await audit(user, key ? "collection.edit" : "collection.create", c.slug, { items: mediaSlugs.length });
    return `Saved ${c.title}.`;
  });
}

export async function deleteCollection(slug: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.deleteCollection(slug);
    await audit(user, "collection.delete", slug);
    return "Deleted. The media in it is untouched.";
  });
}
