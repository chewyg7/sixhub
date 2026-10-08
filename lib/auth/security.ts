import "server-only";
import { isIP } from "node:net";
import { db, fromJson, now, toJson } from "@/lib/db";

/* ------------------------------------------------------------------ */
/* Blocked IPs: refused at sign-in before any password check            */
/* ------------------------------------------------------------------ */

const BLOCK_KEY = "security:blocked_ips";

export interface BlockedIp {
  ip: string;
  note: string;
  at: number;
  by: string;
}

export function blockedIps(): BlockedIp[] {
  const r = db().prepare("SELECT value FROM meta WHERE key = ?").get(BLOCK_KEY) as { value: string } | undefined;
  return r ? fromJson<BlockedIp[]>(r.value, []) : [];
}

export const isBlockedIp = (ip: string) => blockedIps().some((b) => b.ip === ip);

function saveBlocked(list: BlockedIp[]) {
  db().prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(BLOCK_KEY, toJson(list));
}

export function blockIp(ip: string, note: string, by: string) {
  const clean = ip.trim();
  if (!isIP(clean)) throw new Error("That isn't a valid IPv4 or IPv6 address.");
  const list = blockedIps().filter((b) => b.ip !== clean);
  if (list.length >= 500) throw new Error("The block list is full (500). Remove some first.");
  saveBlocked([...list, { ip: clean, note: note.slice(0, 120), at: now(), by }]);
}

export function unblockIp(ip: string) {
  saveBlocked(blockedIps().filter((b) => b.ip !== ip));
}

/* ------------------------------------------------------------------ */
/* Overview for the security page                                      */
/* ------------------------------------------------------------------ */

export interface SessionOverview {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  role: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
  lastSeenAt: number;
}

export function listAllSessions(): SessionOverview[] {
  return (
    db()
      .prepare(
        `SELECT s.id, s.user_id, u.username, u.display_name, u.role, s.ip, s.user_agent, s.created_at, s.last_seen_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.mfa_pending = 0 AND s.expires_at > ? ORDER BY s.last_seen_at DESC`,
      )
      .all(now()) as { id: string; user_id: string; username: string; display_name: string; role: string; ip: string | null; user_agent: string | null; created_at: number; last_seen_at: number }[]
  ).map((r) => ({ id: r.id, userId: r.user_id, username: r.username, displayName: r.display_name, role: r.role, ip: r.ip, userAgent: r.user_agent, createdAt: r.created_at, lastSeenAt: r.last_seen_at }));
}

export const revokeSessionById = (id: string) => db().prepare("DELETE FROM sessions WHERE id = ?").run(id).changes > 0;
export const revokeAllExcept = (sessionId: string) => db().prepare("DELETE FROM sessions WHERE id != ?").run(sessionId).changes;

export interface ThrottleRow {
  key: string;
  failures: number;
  lockedUntil: number;
  lockouts: number;
  windowStart: number;
  locked: boolean;
}

/** Keys with recent failures or an active lock. */
export function listThrottle(): ThrottleRow[] {
  return (
    db()
      .prepare("SELECT * FROM login_throttle WHERE locked_until > ? OR (failures > 0 AND window_start > ?) ORDER BY MAX(locked_until, window_start) DESC LIMIT 200")
      .all(now(), now() - 24 * 60 * 60_000) as { key: string; failures: number; locked_until: number; lockouts: number; window_start: number }[]
  ).map((r) => ({ key: r.key, failures: r.failures, lockedUntil: r.locked_until, lockouts: r.lockouts, windowStart: r.window_start, locked: r.locked_until > now() }));
}

export const clearThrottleKey = (key: string) => db().prepare("DELETE FROM login_throttle WHERE key = ?").run(key);
export const clearAllThrottle = () => db().prepare("DELETE FROM login_throttle").run().changes;
