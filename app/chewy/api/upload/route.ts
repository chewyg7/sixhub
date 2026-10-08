import { createWriteStream } from "node:fs";
import { open, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { requireUser, Forbidden } from "@/lib/auth/session";
import { assertSameOrigin, errorResponse } from "@/lib/auth/csrf";
import { audit } from "@/lib/auth/audit";
import { getUserById, updateProfile } from "@/lib/auth/users";
import { UPLOAD_DIR } from "@/lib/db";
import { fileFont, getFolder, listCategories, listSources, mediaSlugExists, upsertMedia, type StoredMedia } from "@/lib/db/content";
import { ingestFile } from "@/lib/media/ingest";
import { MAX_BYTES, sniff } from "@/lib/media/sniff";
import { titleFromFilename, uniqueSlug } from "@/lib/slug";

/**
 * POST /chewy/api/upload — one file per request, raw body (so large videos
 * stream to disk with progress). Metadata travels in the `x-upload-meta`
 * header as URI-encoded JSON. Owners publish immediately; admins' uploads
 * wait in the review queue until an owner approves them.
 */
export const maxDuration = 900;

const list = z.array(z.string().trim().min(1).max(64)).max(40).default([]);
const MetaSchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("avatar") }),
  z.object({
    purpose: z.literal("media"),
    filename: z.string().max(200),
    title: z.string().trim().max(160).optional(),
    description: z.string().trim().max(4000).optional(),
    folderId: z.string().max(80),
    category: z.string().max(64),
    sourceSlug: z.string().max(64),
    tags: list,
    characters: list,
    locations: list,
    credit: z.string().trim().max(120).optional(),
    verification: z.enum(["official", "reported", "community"]).default("official"),
    datePublished: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    downloadable: z.boolean().default(true),
    hidden: z.boolean().default(false),
  }),
]);

const HARD_MAX = Math.max(...Object.values(MAX_BYTES));

/** Streams the request body to a temp file, enforcing the size limit for the detected type. */
async function receive(request: NextRequest): Promise<{ file: string; size: number }> {
  if (!request.body) throw new Error("No file received.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > HARD_MAX) throw new Error("That file is too large.");
  const file = path.join(tmpdir(), `gh-upload-${randomBytes(8).toString("hex")}`);
  const out = createWriteStream(file, { mode: 0o600 });
  let size = 0;
  try {
    for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > HARD_MAX) throw new Error("That file is too large.");
      if (!out.write(chunk)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    return { file, size };
  } catch (e) {
    out.destroy();
    await rm(file, { force: true });
    throw e;
  }
}

async function head(file: string) {
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(64);
    await fh.read(buf, 0, 64, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

export async function POST(request: NextRequest) {
  let tmp: string | null = null;
  try {
    const user = await requireUser();
    assertSameOrigin(request);
    const rawMeta = request.headers.get("x-upload-meta") ?? "";
    if (rawMeta.length > 16_000) throw new Error("Too much metadata.");
    const meta = MetaSchema.parse(JSON.parse(decodeURIComponent(rawMeta || "%7B%7D")));

    const received = await receive(request);
    tmp = received.file;
    const kind = sniff(await head(tmp));
    if (!kind) throw new Error("That file type isn't supported. Upload JPEG, PNG, WebP, GIF, AVIF, MP4, MOV, WebM, MP3, M4A, WAV, OGG, FLAC, TTF, OTF, WOFF or WOFF2.");
    if (received.size > MAX_BYTES[kind.kind]) throw new Error(`That ${kind.kind} is larger than the ${Math.round(MAX_BYTES[kind.kind] / 1024 / 1024)} MB limit.`);

    /* ---- Avatar ---- */
    if (meta.purpose === "avatar") {
      if (kind.kind !== "image") throw new Error("Avatars must be images.");
      const dir = path.join(UPLOAD_DIR, "avatars");
      await mkdir(dir, { recursive: true });
      const name = `${user.id.slice(0, 8)}-${randomBytes(6).toString("hex")}.webp`;
      // Re-encoding drops metadata and anything that isn't pixels.
      const out = await sharp(tmp, { limitInputPixels: 50_000_000 }).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
      await writeFile(path.join(dir, name), out);
      const old = getUserById(user.id)?.avatarUrl;
      updateProfile(user.id, { displayName: user.displayName, bio: user.bio, links: user.links, avatarUrl: `/files/avatars/${name}` });
      if (old?.startsWith("/files/avatars/")) await rm(path.join(dir, path.basename(old)), { force: true });
      await audit(user, "profile.avatar");
      return Response.json({ url: `/files/avatars/${name}` });
    }

    /* ---- Media ---- */
    if (meta.folderId && !getFolder(meta.folderId)) throw new Error("That folder no longer exists.");
    if (!listCategories().some((c) => c.slug === meta.category)) throw new Error("Unknown category.");
    if (!listSources().some((s) => s.slug === meta.sourceSlug)) throw new Error("Unknown source.");
    const title = meta.title?.trim() || titleFromFilename(meta.filename) || "Untitled";
    const slug = uniqueSlug(title, mediaSlugExists);
    const dir = `${slug}-${randomBytes(3).toString("hex")}`;
    const ingested = await ingestFile(tmp, kind, dir, meta.filename);
    const today = new Date().toISOString().slice(0, 10);
    const item: StoredMedia = fileFont({
      id: slug,
      slug,
      title,
      kind: ingested.kind,
      category: meta.category,
      folderId: meta.folderId,
      description: meta.description || `${title}.`,
      alt: title,
      datePublished: meta.datePublished ?? today,
      dateAdded: new Date().toISOString(),
      sourceSlug: meta.sourceSlug,
      width: ingested.width,
      height: ingested.height,
      original: ingested.original,
      variants: ingested.variants,
      poster: ingested.poster,
      blurDataUrl: ingested.blurDataUrl,
      dominantColor: ingested.dominantColor,
      video: ingested.video,
      audio: ingested.audio,
      font: ingested.font,
      storyboard: ingested.storyboard,
      tags: meta.tags,
      characters: meta.characters,
      locations: meta.locations,
      downloadable: meta.downloadable,
      credit: meta.credit,
      verification: meta.verification,
    });
    const status = user.role === "owner" ? "published" : "pending";
    upsertMedia(item, { createdBy: user.id, status, hidden: user.role === "owner" ? meta.hidden : false });
    await audit(user, "media.upload", slug, { kind: item.kind, status, folder: meta.folderId, bytes: received.size });
    if (status === "published" && !meta.hidden) revalidatePath("/", "layout");
    return Response.json({ slug, status });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Some upload details were invalid." }, { status: 400 });
    if (e instanceof SyntaxError) return Response.json({ error: "Bad upload metadata." }, { status: 400 });
    if (e instanceof Forbidden) return errorResponse(e);
    return errorResponse(e);
  } finally {
    if (tmp) await rm(tmp, { force: true });
  }
}
