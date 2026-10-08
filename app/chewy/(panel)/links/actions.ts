"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { hrefField, run, slugField, str, type ActionState } from "@/lib/admin/action";
import { deleteShortLink, saveShortLink } from "@/lib/db/extras";

export async function saveLink(previous: string | null, _: ActionState, f: FormData): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const link = { slug: slugField.parse(str(f, "slug")), url: hrefField.parse(str(f, "url")), note: z.string().trim().max(120).parse(str(f, "note")), createdBy: user.username };
      saveShortLink(link, previous ?? undefined);
      await audit(user, previous ? "link.update" : "link.create", link.slug, { url: link.url });
      revalidatePath("/chewy/links");
      return `/go/${link.slug} saved.`;
    },
    { revalidate: false },
  );
}

export async function removeLink(slug: string): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      deleteShortLink(slug);
      await audit(user, "link.delete", slug);
      revalidatePath("/chewy/links");
      return `/go/${slug} deleted.`;
    },
    { revalidate: false },
  );
}
