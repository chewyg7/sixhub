"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { scanGtavice, startImport, type ScanGallery } from "@/lib/grabber/gtavice";

export async function scanAction(): Promise<{ galleries?: ScanGallery[]; error?: string }> {
  try {
    const user = await requireOwner();
    const galleries = await scanGtavice();
    await audit(user, "grabber.scan", null, { galleries: galleries.length, new: galleries.reduce((n, g) => n + g.newItems.length, 0) });
    return { galleries };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Scan failed." };
  }
}

const Item = z.object({
  title: z.string().max(300),
  path: z.string().regex(/^\/content\/images\/[A-Za-z0-9/._-]+$/, "bad path"),
  etag: z.string().regex(/^[0-9a-f]{1,16}$/).optional(),
  thumb: z.string().max(500),
  slug: z.string().regex(/^gv-[a-z0-9-]+$/),
});
const Request = z.object({
  gallery: z.string().regex(/^[a-z0-9-]{1,120}$/),
  galleryTitle: z.string().max(160),
  galleryUrl: z.string().regex(/^https:\/\/www\.gtavice\.net\/galleries\/[a-z0-9-]+$/),
  folderId: z.string().max(120),
  category: z.string().min(1).max(64),
  items: z.array(Item).max(3000),
});

export async function startImportAction(requests: unknown): Promise<{ jobId?: string; error?: string }> {
  try {
    const user = await requireOwner();
    const parsed = z.array(Request).max(100).parse(requests).filter((r) => r.items.length);
    if (!parsed.length) return { error: "Pick at least one image." };
    const job = startImport(parsed, user);
    await audit(user, "grabber.import", null, { items: job.total, galleries: parsed.map((p) => p.gallery) });
    return { jobId: job.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the import." };
  }
}
