#!/usr/bin/env node
/**
 * Database snapshot, same as the admin panel's "Back up now": a consistent
 * copy (SQLite's online backup, safe while the site runs) saved to
 * <DATA_DIR>/backups, keeping the newest 20. Run nightly by
 * deploy/gtasixhub-backup.timer, or by hand:
 *
 *   sudo -u gtasixhub bash -c 'set -a; . /etc/gtasixhub.env; cd /srv/gtasixhub && npm run backup'
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "storage"));
const DB_FILE = path.join(DATA_DIR, "gtasixhub.db");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
// Keep in step with lib/admin/system.ts so the panel lists these too.
const BACKUP_RE = /^gtasixhub-\d{8}-\d{6}\.db$/;
const KEEP = 20;

if (!existsSync(DB_FILE)) {
  console.error(`No database at ${DB_FILE}. Is DATA_DIR set?`);
  process.exit(1);
}

await mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
const d = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const name = `gtasixhub-${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}.db`;
const file = path.join(BACKUP_DIR, name);

const db = new Database(DB_FILE, { fileMustExist: true });
await db.backup(file);
db.close();
await chmod(file, 0o600);

const all = (await readdir(BACKUP_DIR)).filter((f) => BACKUP_RE.test(f)).sort().reverse();
for (const old of all.slice(KEEP)) await rm(path.join(BACKUP_DIR, old), { force: true });

console.log(`Backed up to ${file} (${((await stat(file)).size / 1024 / 1024).toFixed(1)} MB). Keeping ${Math.min(all.length, KEEP)}.`);
