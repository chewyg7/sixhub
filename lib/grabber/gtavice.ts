import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { open } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { db, now, toJson, fromJson } from "@/lib/db";
import * as repo from "@/lib/db/content";
import { ingestFile } from "@/lib/media/ingest";
import { sniff } from "@/lib/media/sniff";
import { uniqueSlug } from "@/lib/slug";
import { guessNewGallery, inferTags, KNOWN_GALLERIES, placeGvItem } from "./placement";

/**
 * GTAVice grabber. Scans gtavice.net's galleries, lists images the archive
 * doesn't have yet (matched by their path on gtavice.net), and imports the
 * chosen ones in the background through the normal media pipeline.
 * Only gtavice.net is ever contacted.
 */
const ORIGIN = "https://www.gtavice.net";
const UA = "Mozilla/5.0 (compatible; GTA6HubGrabber/1.0; +https://gtasixhub.com)";
const MAX_IMAGE = 80 * 1024 * 1024;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`gtavice.net answered ${res.status} for ${url}`);
  return res.text();
}

export interface ScanItem {
  title: string;
  path: string;
  etag?: string;
  thumb: string;
  slug: string;
}
export interface ScanGallery {
  slug: string;
  title: string;
  url: string;
  total: number;
  known: boolean;
  /** Suggested destination for new items. */
  folderId: string;
  category: string;
  newItems: ScanItem[];
}

/** Same slug scheme as scripts/import-gtavice.mjs, so slugs line up with existing items. */
export function slugForFile(file: string) {
  const base = file.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  if (base.length <= 44) return `gv-${base}`;
  let h = 0;
  for (const c of base) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return `gv-${base.slice(0, 36).replace(/-+$/, "")}-${h.toString(36).slice(0, 6)}`;
}

export async function scanGtavice(): Promise<ScanGallery[]> {
  const index = await fetchText(`${ORIGIN}/galleries`);
  const galleries = new Map<string, string>();
  for (const m of index.matchAll(/<a href="\/galleries\/([a-z0-9-]+)">([^<]+)<\/a>/g)) galleries.set(m[1], decode(m[2]).trim());
  for (const m of index.matchAll(/href="\/galleries\/([a-z0-9-]+)"/g)) if (!galleries.has(m[1])) galleries.set(m[1], m[1].replace(/-/g, " "));

  const folders = repo.listFolders();
  const out: ScanGallery[] = [];
  for (const [slug, title] of galleries) {
    const url = `${ORIGIN}/galleries/${slug}`;
    const html = await fetchText(url);
    const items: ScanItem[] = [];
    for (const m of html.matchAll(/<a title="([^"]*)" href="(\/content\/images\/[^"?]+)(?:\?etag=([0-9a-f]+))?" data-id="\d+"/g)) {
      const file = m[2].split("/").pop()!;
      items.push({ title: decode(m[1]).trim(), path: m[2], etag: m[3], thumb: `${ORIGIN}/content/images/gallery/${file}${m[3] ? `?etag=${m[3]}` : ""}`, slug: slugForFile(file) });
    }
    const have = repo.originKeysExist(items.map((i) => `gtavice:${i.path}`));
    const known = !!KNOWN_GALLERIES[slug];
    let folderId = KNOWN_GALLERIES[slug]?.folder ?? "";
    let category = KNOWN_GALLERIES[slug]?.category ?? "";
    if (!known) {
      const g = guessNewGallery(slug, title);
      category = g.category;
      folderId = `new:${g.parent}`;
    }
    if (folderId && !folderId.startsWith("new:") && !folders.some((f) => f.id === folderId)) folderId = "";
    out.push({ slug, title, url, total: items.length, known, folderId, category, newItems: items.filter((i) => !have.has(`gtavice:${i.path}`)) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Import job                                                          */
/* ------------------------------------------------------------------ */

export interface ImportRequest {
  gallery: string;
  galleryTitle: string;
  galleryUrl: string;
  /** Existing folder id, "new:<parentId>" to create one named after the gallery, or "auto" for the per-image rules. */
  folderId: string;
  category: string;
  items: ScanItem[];
}

export interface JobState {
  id: string;
  status: "running" | "done" | "failed";
  total: number;
  done: number;
  added: number;
  skipped: number;
  failed: number;
  log: string[];
  startedAt: number;
  finishedAt?: number;
  startedBy: string;
  /** Set once the finished import has refreshed the public site's page cache. */
  revalidated?: boolean;
}

const globalJobs = globalThis as unknown as { __gh_grabber?: JobState };

export const currentJob = () => globalJobs.__gh_grabber ?? null;

async function download(url: string): Promise<string> {
  const u = new URL(url);
  if (u.origin !== ORIGIN) throw new Error("Refusing to download from outside gtavice.net");
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "error", signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE) throw new Error("File too large");
  const file = path.join(tmpdir(), `gh-grab-${randomBytes(8).toString("hex")}`);
  let size = 0;
  const counted = Readable.fromWeb(res.body as never).on("data", (c: Buffer) => {
    size += c.length;
    if (size > MAX_IMAGE) counted.destroy(new Error("File too large"));
  });
  await pipeline(counted, createWriteStream(file, { mode: 0o600 }));
  return file;
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

/** Creates (or reuses) a folder for a new gallery inside `parentId`. */
function folderForNewGallery(parentId: string, title: string, gallery: string): string {
  const existing = repo.listFolders().find((f) => (f.parentId ?? "") === parentId && f.slug === gallery);
  if (existing) return existing.id;
  return repo.saveFolder({ parentId: parentId || null, slug: gallery, name: title.slice(0, 80), description: "", sort: 100 }).id;
}

export function startImport(requests: ImportRequest[], user: { id: string; username: string }): JobState {
  const running = currentJob();
  if (running?.status === "running") throw new Error("An import is already running.");
  const job: JobState = {
    id: randomUUID(),
    status: "running",
    total: requests.reduce((n, r) => n + r.items.length, 0),
    done: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    log: [],
    startedAt: now(),
    startedBy: user.username,
  };
  globalJobs.__gh_grabber = job;
  db().prepare("INSERT INTO grabber_runs (id, started_at, status, started_by, report) VALUES (?, ?, 'running', ?, '{}')").run(job.id, job.startedAt, user.username);

  void (async () => {
    const sources = new Set(repo.listSources().map((s) => s.slug));
    try {
      for (const req of requests) {
        let folder = req.folderId;
        if (folder.startsWith("new:")) folder = folderForNewGallery(folder.slice(4), req.galleryTitle, req.gallery);
        const known = KNOWN_GALLERIES[req.gallery];
        const added: string[] = [];
        for (const it of req.items) {
          const key = `gtavice:${it.path}`;
          try {
            if (repo.originKeysExist([key]).size) {
              job.skipped++;
              continue;
            }
            const tmp = await download(`${ORIGIN}${it.path}`);
            try {
              const kind = sniff(await head(tmp));
              if (!kind || kind.kind !== "image") throw new Error("Not an image");
              const tags = inferTags(it.path.split("/").pop() ?? it.slug);
              const slug = repo.mediaSlugExists(it.slug) ? uniqueSlug(it.slug, repo.mediaSlugExists) : it.slug;
              const place = folder === "auto" ? placeGvItem(req.gallery, slug, tags.characters, tags.locations, req.category) : { folder, category: req.category };
              const dir = `${slug}-${randomBytes(3).toString("hex")}`;
              const ing = await ingestFile(tmp, kind, dir, it.path.split("/").pop() ?? `${slug}.${kind.ext}`);
              const date = known?.date ?? (it.etag ? new Date(parseInt(it.etag, 16) * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
              repo.upsertMedia(
                {
                  id: slug,
                  slug,
                  title: it.title || slug,
                  kind: "image",
                  category: place.category,
                  folderId: repo.getFolder(place.folder) ? place.folder : "",
                  description: `${it.title}. Official Grand Theft Auto VI image from Rockstar Games.`,
                  alt: it.title,
                  datePublished: date,
                  dateAdded: new Date().toISOString(),
                  sourceSlug: known && sources.has(known.source) ? known.source : "rockstar-website",
                  officialUrl: req.galleryUrl,
                  width: ing.width,
                  height: ing.height,
                  original: ing.original,
                  variants: ing.variants,
                  blurDataUrl: ing.blurDataUrl,
                  dominantColor: ing.dominantColor,
                  tags: [],
                  characters: tags.characters,
                  locations: tags.locations,
                  downloadable: true,
                  credit: "Rockstar Games",
                  verification: "official",
                },
                // Credited to whoever ran the import (shows on their profile).
                { originKey: key, status: "published", createdBy: user.id },
              );
              added.push(slug);
              job.added++;
            } finally {
              await rm(tmp, { force: true });
            }
          } catch (e) {
            job.failed++;
            job.log.push(`✖ ${it.title || it.path}: ${e instanceof Error ? e.message : "failed"}`);
          } finally {
            job.done++;
          }
        }
        // Add the new images to the gallery's collection (creating it for new galleries).
        if (added.length) {
          const colSlug = known?.collection ?? req.gallery;
          const col = repo.listCollections().find((c) => c.slug === colSlug);
          if (col) repo.saveCollection({ ...col, mediaSlugs: [...col.mediaSlugs, ...added.filter((s) => !col.mediaSlugs.includes(s))] });
          else
            repo.saveCollection({
              slug: colSlug,
              title: req.galleryTitle,
              kind: "curated",
              description: `Images from the ${req.galleryTitle} gallery on GTAVice.net.`,
              coverSlug: added[0],
              mediaSlugs: added,
              sources: [{ label: "GTAVice.net gallery", url: req.galleryUrl }],
            });
          job.log.push(`✔ ${req.galleryTitle}: added ${added.length}`);
        }
      }
      job.status = "done";
    } catch (e) {
      job.status = "failed";
      job.log.push(`✖ ${e instanceof Error ? e.message : "Import failed"}`);
    } finally {
      job.finishedAt = now();
      db()
        .prepare("UPDATE grabber_runs SET finished_at = ?, status = ?, report = ? WHERE id = ?")
        .run(job.finishedAt, job.status, toJson({ total: job.total, added: job.added, skipped: job.skipped, failed: job.failed, log: job.log.slice(-50) }), job.id);
    }
  })();
  return job;
}

/**
 * Called from the owner's status polling (a real request), so the finished
 * import can refresh the public site's page cache.
 */
export function revalidateIfFinished() {
  const job = currentJob();
  if (job && job.status !== "running" && !job.revalidated && job.added > 0) {
    revalidatePath("/", "layout");
    job.revalidated = true;
  }
}

export function listRuns(limit = 10) {
  return (db().prepare("SELECT * FROM grabber_runs ORDER BY started_at DESC LIMIT ?").all(limit) as { id: string; started_at: number; finished_at: number | null; status: string; started_by: string | null; report: string }[]).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    startedBy: r.started_by,
    report: fromJson<{ total?: number; added?: number; skipped?: number; failed?: number; log?: string[] }>(r.report, {}),
  }));
}
