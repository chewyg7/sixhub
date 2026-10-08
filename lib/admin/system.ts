import "server-only";
import { mkdir, readdir, rm, stat, statfs } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, UPLOAD_DIR, db } from "@/lib/db";
import { listMediaRows } from "@/lib/db/content";

/** Database snapshots live next to the database, never under the public uploads. */
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_RE = /^gtasixhub-\d{8}-\d{6}\.db$/;
const KEEP = 20;

async function dirSize(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  const entries = await readdir(/*turbopackIgnore: true*/ dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const s = await dirSize(p);
      bytes += s.bytes;
      files += s.files;
    } else if (e.isFile()) {
      bytes += (await stat(/*turbopackIgnore: true*/ p).catch(() => ({ size: 0 }))).size;
      files++;
    }
  }
  return { bytes, files };
}

export async function systemStats() {
  const dbFile = path.join(DATA_DIR, "gtasixhub.db");
  const [dbStat, wal, uploads, backups, disk] = await Promise.all([
    stat(/*turbopackIgnore: true*/ dbFile).catch(() => null),
    stat(/*turbopackIgnore: true*/ `${dbFile}-wal`).catch(() => null),
    dirSize(UPLOAD_DIR),
    dirSize(BACKUP_DIR),
    statfs(/*turbopackIgnore: true*/ DATA_DIR).catch(() => null),
  ]);
  const rows = listMediaRows({ all: true });
  const kinds: Record<string, number> = {};
  for (const r of rows) kinds[r.item.kind] = (kinds[r.item.kind] ?? 0) + 1;
  const mem = process.memoryUsage();
  return {
    database: (dbStat?.size ?? 0) + (wal?.size ?? 0),
    uploads,
    backups,
    disk: disk ? { free: disk.bavail * disk.bsize, total: disk.blocks * disk.bsize } : null,
    media: { total: rows.length, kinds },
    node: process.version,
    uptime: process.uptime(),
    memory: mem.rss,
    dataDir: DATA_DIR,
  };
}

export interface BackupFile {
  name: string;
  bytes: number;
  at: number;
}

export async function listBackups(): Promise<BackupFile[]> {
  const names = (await readdir(/*turbopackIgnore: true*/ BACKUP_DIR).catch(() => [] as string[])).filter((n) => BACKUP_RE.test(n));
  const out = await Promise.all(
    names.map(async (name) => {
      const s = await stat(/*turbopackIgnore: true*/ path.join(BACKUP_DIR, name));
      return { name, bytes: s.size, at: s.mtimeMs };
    }),
  );
  return out.sort((a, b) => b.at - a.at);
}

/** Path of a backup by name, or null if the name isn't one of ours. */
export function backupPath(name: string): string | null {
  return BACKUP_RE.test(name) ? path.join(BACKUP_DIR, name) : null;
}

/** Consistent online snapshot of the database (SQLite's backup API; safe while the site runs). */
export async function createBackup(): Promise<BackupFile> {
  await mkdir(/*turbopackIgnore: true*/ BACKUP_DIR, { recursive: true, mode: 0o700 });
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const name = `gtasixhub-${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}.db`;
  const file = path.join(BACKUP_DIR, name);
  await db().backup(file);
  // Keep the newest few.
  const all = await listBackups();
  for (const old of all.slice(KEEP)) await rm(/*turbopackIgnore: true*/ path.join(BACKUP_DIR, old.name), { force: true });
  const s = await stat(/*turbopackIgnore: true*/ file);
  return { name, bytes: s.size, at: s.mtimeMs };
}

export async function deleteBackup(name: string) {
  const p = backupPath(name);
  if (!p) throw new Error("Unknown backup.");
  await rm(/*turbopackIgnore: true*/ p, { force: true });
}

/** Media whose uploaded files are missing from disk. */
export async function findMissingFiles(): Promise<{ slug: string; title: string; missing: string[] }[]> {
  const out: { slug: string; title: string; missing: string[] }[] = [];
  for (const { item } of listMediaRows({ all: true })) {
    const urls = [item.original.url, item.poster?.url, ...item.variants.map((v) => v.url)].filter((u): u is string => !!u && u.startsWith("/files/"));
    const missing: string[] = [];
    for (const u of urls) {
      const rel = u.slice("/files/".length).split("/");
      const ok = await stat(/*turbopackIgnore: true*/ path.join(UPLOAD_DIR, ...rel)).then(
        (s) => s.isFile(),
        () => false,
      );
      if (!ok) missing.push(u);
    }
    if (missing.length) out.push({ slug: item.slug, title: item.title, missing });
  }
  return out;
}

/** Site content as JSON (no accounts, sessions or secrets). */
export function exportContent() {
  const d = db();
  const table = (t: string) => d.prepare(`SELECT * FROM ${t}`).all();
  return {
    exportedAt: new Date().toISOString(),
    folders: table("folders"),
    media: table("media"),
    categories: table("categories"),
    sources: table("sources"),
    tags: table("tags"),
    collections: table("collections"),
    info_sections: table("info_sections"),
    info_entries: table("info_entries"),
    timeline: table("timeline"),
    faq: table("faq"),
    settings: table("settings"),
    pages: table("pages"),
    short_links: table("short_links"),
  };
}
