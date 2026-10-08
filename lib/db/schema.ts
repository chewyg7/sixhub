/**
 * Schema migrations, applied in order. Never edit a shipped migration; add a
 * new one. Content rows keep their queryable fields as columns and the rest
 * of the record in a JSON `data` column.
 */
export const MIGRATIONS: string[] = [
  /* 1: initial schema */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '{}',
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    recovery_codes TEXT NOT NULL DEFAULT '[]',
    disabled INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    password_changed_at INTEGER NOT NULL,
    last_login_at INTEGER
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                 -- SHA-256 of the cookie token; the token itself is never stored
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    mfa_pending INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE login_throttle (
    key TEXT PRIMARY KEY,                -- "ip:<addr>" or "user:<name>"
    failures INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    locked_until INTEGER NOT NULL DEFAULT 0,
    lockouts INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    user_id TEXT,
    username TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    ip TEXT
  );
  CREATE INDEX audit_at ON audit_log(at DESC);

  CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL DEFAULT '',  -- '' = top level
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_slug TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (parent_id, slug)
  );

  CREATE TABLE media (
    slug TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    category TEXT NOT NULL,
    folder_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    date_published TEXT NOT NULL,
    date_added TEXT NOT NULL,
    origin_key TEXT,                     -- stable id of the upstream file (e.g. GTAVice path) for de-duplication
    hidden INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    created_by TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX media_folder ON media(folder_id);
  CREATE INDEX media_category ON media(category);
  CREATE UNIQUE INDEX media_origin ON media(origin_key) WHERE origin_key IS NOT NULL;

  CREATE TABLE categories (slug TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
  CREATE TABLE sources (slug TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE tags (slug TEXT PRIMARY KEY, label TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE collections (slug TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
  CREATE TABLE info_sections (slug TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
  CREATE TABLE info_entries (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    UNIQUE (section, slug)
  );
  CREATE TABLE timeline (id TEXT PRIMARY KEY, date TEXT NOT NULL, data TEXT NOT NULL);
  CREATE TABLE faq (id TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE grabber_runs (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT NOT NULL,               -- running | done | failed
    started_by TEXT,
    report TEXT NOT NULL DEFAULT '{}'
  );
  `,

  /* 2: upload review queue, TOTP replay protection */ `
  ALTER TABLE media ADD COLUMN status TEXT NOT NULL DEFAULT 'published';  -- published | pending (admin uploads await an owner)
  CREATE INDEX media_status ON media(status);
  ALTER TABLE users ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0; -- last accepted TOTP time step; codes can't be reused
  `,
];
