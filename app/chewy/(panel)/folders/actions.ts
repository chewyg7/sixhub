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

/** Drag and drop: moves a folder inside another folder (or to the top level when `parentId` is null). */
export async function moveFolderAction(id: string, parentId: string | null): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const f = repo.getFolder(id);
    if (!f) throw new Error("That folder no longer exists.");
    if (parentId && !repo.getFolder(parentId)) throw new Error("The target folder no longer exists.");
    if ((f.parentId ?? null) === parentId) return `${f.name} is already there.`;
    const siblings = repo.listFolders().filter((x) => (x.parentId ?? null) === parentId);
    if (siblings.some((x) => x.slug === f.slug)) throw new Error(`There's already a folder called “${f.slug}” there. Rename one first.`);
    // saveFolder refuses moves into the folder itself or its own sub-folders.
    repo.saveFolder({ ...f, parentId, sort: siblings.length });
    const target = parentId ? repo.getFolder(parentId)?.name : "the top level";
    await audit(user, "folder.move", id, { to: parentId ?? "(top level)" });
    return `Moved ${f.name} to ${target}.`;
  });
}

/** Drag and drop: files media items into a folder ("" = unfiled). */
export async function moveItemsAction(slugs: string[], folderId: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const list = z.array(z.string().min(1).max(120)).min(1).max(2000).parse(slugs);
    if (folderId && !repo.getFolder(folderId)) throw new Error("The target folder no longer exists.");
    repo.moveMedia(list, folderId);
    const target = folderId ? repo.getFolder(folderId)?.name : "Unfiled";
    await audit(user, "media.move", folderId || "(unfiled)", { count: list.length, items: list.slice(0, 20) });
    return `Moved ${list.length} item${list.length === 1 ? "" : "s"} to ${target}.`;
  });
}
