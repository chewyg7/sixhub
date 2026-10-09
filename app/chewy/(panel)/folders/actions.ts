"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { run, slugField, str, type ActionState } from "@/lib/admin/action";
import * as repo from "@/lib/db/content";
import { slugify } from "@/lib/slug";

const FolderForm = z.object({
  id: z.string().max(80).optional(),
  name: z.string().min(1).max(80),
  slug: slugField,
  description: z.string().max(600),
  parentId: z.string().max(80),
  sort: z.coerce.number().int().min(0).max(10_000),
  coverSlug: z.string().max(80),
});

export async function saveFolderAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const name = str(form, "name");
    const f = FolderForm.parse({
      id: str(form, "id") || undefined,
      name,
      slug: str(form, "slug") || slugify(name),
      description: str(form, "description"),
      parentId: str(form, "parentId"),
      sort: str(form, "sort") || "0",
      coverSlug: str(form, "coverSlug"),
    });
    if (f.parentId && !repo.getFolder(f.parentId)) throw new Error("The parent folder doesn't exist.");
    if (f.coverSlug && !repo.mediaSlugExists(f.coverSlug)) throw new Error("No media item has that cover slug.");
    const saved = repo.saveFolder({ id: f.id, name: f.name, slug: f.slug, description: f.description, parentId: f.parentId || null, sort: f.sort, coverSlug: f.coverSlug || undefined });
    await audit(user, f.id ? "folder.edit" : "folder.create", saved.id, { name: f.name });
    return f.id ? `Saved ${f.name}.` : `Created ${f.name}.`;
  });
}

export async function deleteFolderAction(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const f = repo.getFolder(id);
    if (!f) throw new Error("That folder no longer exists.");
    repo.deleteFolder(id);
    await audit(user, "folder.delete", id, { name: f.name });
    return `Deleted ${f.name}. Its contents moved up a level.`;
  });
}

/** Saves a batch of pending drag-and-drop moves from the folder editor. */
export async function applyFolderChanges(changes: { folders: [string, string | null][]; items: [string, string][] }): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const c = z
      .object({
        folders: z.array(z.tuple([z.string().min(1).max(200), z.string().max(200).nullable()])).max(500),
        items: z.array(z.tuple([z.string().min(1).max(120), z.string().max(200)])).max(5000),
      })
      .parse(changes);
    // Folders first (in the order they were dragged), so items can go into folders that just moved.
    for (const [id, parentId] of c.folders) {
      const f = repo.getFolder(id);
      if (!f) throw new Error("A folder you moved no longer exists. Reload and try again.");
      if (parentId && !repo.getFolder(parentId)) throw new Error("A target folder no longer exists. Reload and try again.");
      if ((f.parentId ?? null) === parentId) continue;
      const siblings = repo.listFolders().filter((x) => (x.parentId ?? null) === parentId);
      if (siblings.some((x) => x.slug === f.slug)) throw new Error(`There's already a folder called “${f.slug}” where you moved ${f.name}. Rename one first.`);
      repo.saveFolder({ ...f, parentId, sort: siblings.length });
    }
    const byTarget = new Map<string, string[]>();
    for (const [slug, folderId] of c.items) byTarget.set(folderId, [...(byTarget.get(folderId) ?? []), slug]);
    for (const [folderId, slugs] of byTarget) {
      if (folderId && !repo.getFolder(folderId)) throw new Error("A target folder no longer exists. Reload and try again.");
      repo.moveMedia(slugs, folderId);
    }
    await audit(user, "folders.reorganise", null, { folders: c.folders.length, items: c.items.length });
    const parts = [c.folders.length && `${c.folders.length} folder${c.folders.length === 1 ? "" : "s"}`, c.items.length && `${c.items.length} item${c.items.length === 1 ? "" : "s"}`].filter(Boolean);
    return `Saved. Moved ${parts.join(" and ")}.`;
  });
}
