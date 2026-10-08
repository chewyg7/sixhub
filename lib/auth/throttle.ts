import "server-only";
import { db, now } from "@/lib/db";

/**
 * Brute-force protection for logins and 2FA codes, stored in the database so
 * it survives restarts. Failures are counted per key (an IP address or a
 * username) inside a 15-minute window; hitting the limit locks the key, and
 * every further lockout doubles in length (15 min → 30 → 60 … up to 24 h).
 * Keys exist whether or not the username does, so locks reveal nothing.
 */
const WINDOW = 15 * 60_000;
const BASE_LOCK = 15 * 60_000;
const MAX_LOCK = 24 * 60 * 60_000;

export const LIMITS = { ip: 20, user: 5, mfa: 5 } as const;

interface Row {
  key: string;
  failures: number;
  window_start: number;
  locked_until: number;
  lockouts: number;
}

const get = (key: string) => db().prepare("SELECT * FROM login_throttle WHERE key = ?").get(key) as Row | undefined;

/** Milliseconds until the key unlocks, or 0 if it may try now. */
export function lockedFor(key: string): number {
  const r = get(key);
  return r && r.locked_until > now() ? r.locked_until - now() : 0;
}

export function recordFailure(key: string, limit: number) {
  const t = now();
  const r = get(key);
  if (!r || t - r.window_start > WINDOW) {
    db()
      .prepare("INSERT INTO login_throttle (key, failures, window_start, locked_until, lockouts) VALUES (?, 1, ?, 0, ?) ON CONFLICT(key) DO UPDATE SET failures = 1, window_start = excluded.window_start")
      .run(key, t, r?.lockouts ?? 0);
    return;
  }
  const failures = r.failures + 1;
  if (failures >= limit) {
    const lock = Math.min(MAX_LOCK, BASE_LOCK * 2 ** r.lockouts);
    db().prepare("UPDATE login_throttle SET failures = 0, window_start = ?, locked_until = ?, lockouts = lockouts + 1 WHERE key = ?").run(t, t + lock, key);
  } else {
    db().prepare("UPDATE login_throttle SET failures = ? WHERE key = ?").run(failures, key);
  }
}

export function clearKey(key: string) {
  db().prepare("DELETE FROM login_throttle WHERE key = ?").run(key);
}

/** Lockouts older than a day are forgiven so the escalation resets eventually. */
export function pruneThrottle() {
  db()
    .prepare("DELETE FROM login_throttle WHERE locked_until < ? AND window_start < ?")
    .run(now() - MAX_LOCK, now() - MAX_LOCK);
}

export const ipKey = (ip: string) => `ip:${ip}`;
export const userKey = (u: string) => `user:${u.toLowerCase()}`;
export const mfaKey = (userId: string) => `mfa:${userId}`;

export function formatWait(ms: number) {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.ceil(m / 60)} hour${m >= 120 ? "s" : ""}` : `${m} minute${m === 1 ? "" : "s"}`;
}
