import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "./schema";
import { seedIfEmpty } from "./seed";
import { runFixups } from "./fixups";

/**
 * The site's database: a single SQLite file on the server's disk.
 *
 * Content, folders, settings, admin accounts, sessions and the audit log all
 * live here. Uploaded files live next to it in `<DATA_DIR>/uploads`. Set
 * DATA_DIR in production to a directory outside the app (e.g.
 * /var/lib/gtasixhub) so deploys never touch it.
 */
// Resolved at runtime; the bundler must not try to trace it.
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage"));
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type DB = Database.Database;

const globalForDb = globalThis as unknown as { __gh_db?: DB };

function open(): DB {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "gtasixhub.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  // Build workers and the server may open the file together; wait for locks instead of failing.
  db.pragma("busy_timeout = 15000");
  migrate(db);
  return db;
}

function migrate(db: DB) {
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const current = Number((db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value ?? 0);
  if (current >= MIGRATIONS.length) return;
  // IMMEDIATE takes the write lock up front, so concurrent openers migrate exactly once.
  db.transaction(() => {
    const again = Number((db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value ?? 0);
    for (let v = again; v < MIGRATIONS.length; v++) db.exec(MIGRATIONS[v]);
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(MIGRATIONS.length));
  }).immediate();
}

/** The shared connection (one per server process; survives dev hot reloads). */
export function db(): DB {
  if (!globalForDb.__gh_db) {
    globalForDb.__gh_db = open();
    // Seed lazily on first use so a fresh server needs no manual step.
    seedIfEmpty(globalForDb.__gh_db);
    runFixups(globalForDb.__gh_db);
  }
  return globalForDb.__gh_db;
}

/* ------------------------------------------------------------------ */
/* Content version: bumped on every content write                      */
/* ------------------------------------------------------------------ */

export function contentVersion(): number {
  return Number((db().prepare("SELECT value FROM meta WHERE key = 'content_version'").get() as { value: string } | undefined)?.value ?? 0);
}

export function bumpContentVersion() {
  db().prepare("INSERT INTO meta (key, value) VALUES ('content_version', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1").run();
}

export const now = () => Date.now();

/** JSON column helpers. */
export const toJson = (v: unknown) => JSON.stringify(v ?? null);
export function fromJson<T>(v: string | null | undefined, fallback: T): T {
  if (v == null) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
