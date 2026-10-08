"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { Forbidden, requireOwner, requireUser } from "@/lib/auth/session";
import { bool, csv, isoDate, many, run, slugField, str, httpsUrl, type ActionState } from "@/lib/admin/action";
import * as repo from "@/lib/db/content";
import { removeUploadedFiles } from "@/lib/media/ingest";
import { importRemoteVideo } from "@/lib/media/remote";

const MediaForm = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000),
  alt: z.string().max(400),
  category: z.string().min(1).max(64),
  folderId: z.string().max(80),
  sourceSlug: z.string().min(1).max(64),
  datePublished: isoDate,
  tags: z.array(z.string().max(64)).max(40),
  characters: z.array(z.string().max(64)).max(40),
  locations: z.array(z.string().max(64)).max(40),
  credit: z.string().max(120),
  officialUrl: z.union([httpsUrl, z.literal("")]),
  verification: z.enum(["official", "reported", "community"]),
  downloadable: z.boolean(),
});

/** Admins may only touch their own uploads that are still waiting for review. */
function assertCanEdit(user: { id: string; role: string }, row: repo.MediaRow) {
  if (user.role === "owner") return;
  if (row.createdBy !== user.id || row.status !== "pending") throw new Forbidden("You can only edit your own uploads while they're waiting for review.");
}

export async function saveMedia(slug: string, _: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const row = repo.getMediaRow(slug);
    if (!row) throw new Error("That item no longer exists.");
    assertCanEdit(user, row);
    const f = MediaForm.parse({
      title: str(form, "title"),
      description: str(form, "description"),
      alt: str(form, "alt"),
      category: str(form, "category"),
      folderId: str(form, "folderId"),
      sourceSlug: str(form, "sourceSlug"),
      datePublished: str(form, "datePublished"),
      tags: csv(form, "tags"),
      characters: many(form, "characters"),
      locations: many(form, "locations"),
      credit: str(form, "credit"),
      officialUrl: str(form, "officialUrl"),
      verification: str(form, "verification"),
      downloadable: bool(form, "downloadable"),
    });
    if (!repo.listCategories().some((c) => c.slug === f.category)) throw new Error("Unknown category.");
    if (!repo.listSources().some((s) => s.slug === f.sourceSlug)) throw new Error("Unknown source.");
    if (f.folderId && !repo.getFolder(f.folderId)) throw new Error("Unknown folder.");
    // Fonts: a new family name moves the font into that family's folder (if it was in its old one).
    let fontPatch: Partial<repo.StoredMedia> = {};
    const oldFolder = row.item.folderId ?? "";
    if (row.item.kind === "font" && row.item.font) {
      const family = z.string().trim().min(1, "Add a font family").max(80).parse(str(form, "fontFamily") || row.item.font.family);
      const style = z.string().trim().min(1, "Add a style").max(60).parse(str(form, "fontStyle") || row.item.font.style);
      const inFamilyFolder = f.folderId === oldFolder && (oldFolder === repo.FONTS_FOLDER || oldFolder.startsWith(`${repo.FONTS_FOLDER}/`));
      fontPatch = { font: { ...row.item.font, family, style }, ...(family !== row.item.font.family && inFamilyFolder ? { folderId: repo.ensureFontFamilyFolder(family) } : {}) };
    }
    repo.upsertMedia(
      { ...row.item, ...f, ...fontPatch, officialUrl: f.officialUrl || undefined, credit: f.credit || undefined, alt: f.alt || f.title },
      user.role === "owner" ? { hidden: bool(form, "hidden") } : {},
    );
    // Tidy up a font family folder the last style just left.
    if (fontPatch.folderId && oldFolder.startsWith(`${repo.FONTS_FOLDER}/`) && repo.folderIsEmpty(oldFolder)) repo.deleteFolder(oldFolder);
    await audit(user, "media.edit", slug);
    // Slug changes last, so a failed rename can't lose the other edits.
    const nextSlug = str(form, "slug");
    if (user.role === "owner" && nextSlug && nextSlug !== slug) {
      slugField.parse(nextSlug);
      repo.renameMediaSlug(slug, nextSlug);
      await audit(user, "media.rename", slug, { to: nextSlug });
      redirect(`/chewy/media/${nextSlug}?saved=1`);
    }
    return "Saved. The site is updated.";
  });
}

export async function deleteMediaItems(slugs: string[]): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const rows = slugs.map((s) => repo.getMediaRow(s)).filter((r): r is repo.MediaRow => Boolean(r));
    for (const r of rows) assertCanEdit(user, r);
    const removed = repo.deleteMedia(rows.map((r) => r.item.slug));
    // Only files we stored ourselves are deleted; seed files in /public stay.
    await removeUploadedFiles(removed.flatMap((r) => [r.item.original.url, ...(r.item.variants ?? []).map((v) => v.url)]));
    await audit(user, "media.delete", rows.map((r) => r.item.slug).join(", ").slice(0, 400), { count: rows.length });
    return `Deleted ${rows.length} item${rows.length === 1 ? "" : "s"}.`;
  });
}

export async function deleteMediaAndReturn(slug: string) {
  const res = await deleteMediaItems([slug]);
  if (res.error) return res;
  redirect("/chewy/media?deleted=1");
}

export async function bulkMedia(slugs: string[], op: { type: "move"; folderId: string } | { type: "category"; category: string } | { type: "hide" | "show" } | { type: "tag"; tag: string } | { type: "approve" }): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const list = slugs.filter((s) => typeof s === "string").slice(0, 5000);
    switch (op.type) {
      case "move":
        if (op.folderId && !repo.getFolder(op.folderId)) throw new Error("Unknown folder.");
        repo.moveMedia(list, op.folderId);
        break;
      case "category": {
        if (!repo.listCategories().some((c) => c.slug === op.category)) throw new Error("Unknown category.");
        for (const s of list) {
          const r = repo.getMediaRow(s);
          if (r) repo.upsertMedia({ ...r.item, category: op.category });
        }
        break;
      }
      case "hide":
      case "show":
        repo.setMediaHidden(list, op.type === "hide");
        break;
      case "tag": {
        const tag = op.tag.trim().slice(0, 64);
        if (!tag) throw new Error("Enter a tag.");
        for (const s of list) {
          const r = repo.getMediaRow(s);
          if (r && !r.item.tags.includes(tag)) repo.upsertMedia({ ...r.item, tags: [...r.item.tags, tag] });
        }
        break;
      }
      case "approve":
        repo.setMediaStatus(list, "published");
        break;
    }
    await audit(user, `media.bulk.${op.type}`, null, { count: list.length, ...op });
    return `Updated ${list.length} item${list.length === 1 ? "" : "s"}.`;
  });
}

export async function reviewMedia(slug: string, decision: "approve" | "reject"): Promise<ActionState> {
  if (decision === "approve") return bulkMedia([slug], { type: "approve" });
  return run(async () => {
    const user = await requireOwner();
    const removed = repo.deleteMedia([slug]);
    await removeUploadedFiles(removed.flatMap((r) => [r.item.original.url]));
    await audit(user, "media.reject", slug);
    return "Rejected and removed.";
  });
}

const RemoteForm = z.object({
  url: httpsUrl,
  title: z.string().min(1).max(160),
  folderId: z.string().max(80),
  category: z.string().min(1).max(64),
  sourceSlug: z.string().min(1).max(64),
  datePublished: isoDate,
  renditions: z.array(httpsUrl).max(4),
});

/** Owner-only: add a video that streams from another host (like the Rockstar trailers). */
export async function addRemoteVideo(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const f = RemoteForm.parse({
      url: str(form, "url"),
      title: str(form, "title"),
      folderId: str(form, "folderId"),
      category: str(form, "category"),
      sourceSlug: str(form, "sourceSlug"),
      datePublished: str(form, "datePublished"),
      renditions: str(form, "renditions")
        .split(/\s+/)
        .filter(Boolean),
    });
    const slug = await importRemoteVideo(f, user.id);
    await audit(user, "media.remote_video", slug, { url: f.url });
    redirect(`/chewy/media/${slug}?saved=1`);
  });
}
