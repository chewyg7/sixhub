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
