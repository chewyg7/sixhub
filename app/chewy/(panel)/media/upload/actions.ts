"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import * as repo from "@/lib/db/content";
import { slugify } from "@/lib/slug";

const Paths = z.object({
  parentId: z.string().max(300),
  paths: z.array(z.array(z.string().trim().min(1).max(80)).min(1).max(12)).max(500),
});

/**
 * Folder uploads: makes sure every folder path inside an uploaded folder
 * exists under `parentId`, reusing folders with the same name, and returns
 * the folder id for each path (keyed by the path joined with "/").
 */
export async function ensureUploadFolders(input: { parentId: string; paths: string[][] }): Promise<{ ids?: Record<string, string>; error?: string }> {
  try {
    const user = await requireOwner();
    const { parentId, paths } = Paths.parse(input);
    if (parentId && !repo.getFolder(parentId)) throw new Error("The folder you chose no longer exists.");
    const all = repo.listFolders();
    const ids: Record<string, string> = {};
    let created = 0;
    for (const path of paths) {
      let parent = parentId || null;
      path.forEach((name, i) => {
        const key = path.slice(0, i + 1).join("/");
        if (ids[key]) {
          parent = ids[key];
          return;
        }
        const slug = slugify(name, 60) || "folder";
        const siblings = all.filter((f) => (f.parentId ?? null) === parent);
        let found = siblings.find((f) => f.slug === slug || f.name.toLowerCase() === name.toLowerCase());
        if (!found) {
          const wanted = parent ? `${parent}/${slug}` : slug;
          // Readable path ids while they stay short; deep or long names get a random id instead.
          const id = wanted.length > 120 || all.some((f) => f.id === wanted) ? undefined : wanted;
          found = repo.saveFolder({ id, name, slug, description: "", parentId: parent, sort: siblings.length });
          all.push(found);
          created++;
        }
        ids[key] = found.id;
        parent = found.id;
      });
    }
    if (created) await audit(user, "folder.upload", parentId || null, { created });
    return { ids };
  } catch (e) {
    return { error: e instanceof z.ZodError ? "Some folder names were too long or too deep." : e instanceof Error ? e.message : "Couldn't create the folders." };
  }
}
