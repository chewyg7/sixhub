"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { bool, run, slugField, str, type ActionState } from "@/lib/admin/action";
import { deletePage, getPage, savePage } from "@/lib/db/extras";
import { uniqueSlug } from "@/lib/slug";

export async function createPage(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireOwner();
  const title = z.string().trim().min(1, "Give the page a title").max(90).safeParse(str(f, "title"));
  if (!title.success) return { error: title.error.issues[0].message };
  const slug = uniqueSlug(title.data, (s) => !!getPage(s));
  savePage({ slug, title: title.data, description: "", body: `# ${title.data}\n\nWrite your page here.`, published: false, updatedBy: user.username });
  await audit(user, "page.create", slug);
  redirect(`/chewy/pages/${slug}`);
}

export async function updatePage(previous: string, _: ActionState, f: FormData): Promise<ActionState> {
  let slug = previous;
  const result = await run(async () => {
    const user = await requireOwner();
    if (!getPage(previous)) throw new Error("That page no longer exists.");
    slug = slugField.parse(str(f, "slug"));
    if (slug !== previous && getPage(slug)) throw new Error(`/p/${slug} is already used by another page.`);
    const page = {
      slug,
      title: z.string().trim().min(1, "Add a title").max(90).parse(str(f, "title")),
      description: z.string().trim().max(300).parse(str(f, "description")),
      body: z.string().max(100_000, "That page is too long").parse(String(f.get("body") ?? "")),
      published: bool(f, "published"),
      updatedBy: user.username,
    };
    savePage(page, previous);
    await audit(user, "page.save", slug, { published: page.published, renamedFrom: slug !== previous ? previous : undefined });
    return page.published ? `Saved. Live at /p/${slug}` : "Saved as a draft (not public).";
  });
  if (result.ok && slug !== previous) {
    revalidatePath(`/p/${previous}`);
    redirect(`/chewy/pages/${slug}`);
  }
  return result;
}

export async function removePage(slug: string) {
  const user = await requireOwner();
  deletePage(slug);
  await audit(user, "page.delete", slug);
  revalidatePath("/", "layout");
  redirect("/chewy/pages");
}
