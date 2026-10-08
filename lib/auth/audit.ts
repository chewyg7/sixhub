import "server-only";
import { db, fromJson, now, toJson } from "@/lib/db";
import { clientIp } from "./request";

/** Append-only record of every sign-in and change made in the admin panel. */
export interface AuditEntry {
  id: number;
  at: number;
  userId: string | null;
  username: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
}

export async function audit(actor: { id: string; username: string } | null, action: string, target?: string | null, detail?: Record<string, unknown>) {
  const ip = await clientIp().catch(() => null);
  db()
    .prepare("INSERT INTO audit_log (at, user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(now(), actor?.id ?? null, actor?.username ?? null, action, target ?? null, detail ? toJson(detail) : null, ip);
}

export function listAudit(opts: { limit?: number; before?: number; userId?: string; action?: string } = {}): AuditEntry[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.before) {
    where.push("id < ?");
    args.push(opts.before);
  }
  if (opts.userId) {
    where.push("user_id = ?");
    args.push(opts.userId);
  }
  if (opts.action) {
    where.push("action LIKE ?");
    args.push(`${opts.action}%`);
  }
  const rows = db()
    .prepare(`SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`)
    .all(...args, Math.min(500, opts.limit ?? 100)) as {
    id: number;
    at: number;
    user_id: string | null;
    username: string | null;
    action: string;
    target: string | null;
    detail: string | null;
    ip: string | null;
  }[];
  return rows.map((r) => ({ id: r.id, at: r.at, userId: r.user_id, username: r.username, action: r.action, target: r.target, detail: fromJson(r.detail, null), ip: r.ip }));
}
