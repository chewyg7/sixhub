import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";
import { randomToken, sha256 } from "./crypto";
import { clientIp, userAgent } from "./request";
import { getUserById, type User } from "./users";

/**
 * Admin sessions. The cookie holds a random 256-bit token; the database
 * stores only its SHA-256, so a leaked database can't be replayed as a login.
 * Sessions end after 12 hours, after 2 hours idle, on logout, on password or
 * role change, or when an owner revokes them.
 */
const ABSOLUTE = 12 * 60 * 60_000;
const IDLE = 2 * 60 * 60_000;
const MFA_PENDING = 5 * 60_000;

/** `__Host-` pins the cookie to this exact origin over HTTPS (production only; dev runs on http://localhost). */
export const COOKIE = process.env.NODE_ENV === "production" ? "__Host-chewy_session" : "chewy_session";

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  mfaPending: boolean;
  ip: string | null;
  userAgent: string | null;
}

type Row = { id: string; user_id: string; created_at: number; last_seen_at: number; expires_at: number; mfa_pending: number; ip: string | null; user_agent: string | null };
const toSession = (r: Row): Session => ({
  id: r.id,
  userId: r.user_id,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  expiresAt: r.expires_at,
  mfaPending: !!r.mfa_pending,
  ip: r.ip,
  userAgent: r.user_agent,
});

async function setCookie(token: string, maxAgeMs: number) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

/** Starts a session (always a fresh token: logging in can never reuse an old session id). */
export async function createSession(userId: string, mfaPending: boolean) {
  const token = randomToken(32);
  const t = now();
  const ttl = mfaPending ? MFA_PENDING : ABSOLUTE;
  db()
    .prepare("INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, mfa_pending, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(sha256(token), userId, t, t, t + ttl, mfaPending ? 1 : 0, await clientIp(), await userAgent());
  await setCookie(token, ttl);
}

async function currentRow(): Promise<{ row: Row; user: User } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  const t = now();
  const user = getUserById(row.user_id);
  const expired = row.expires_at <= t || (!row.mfa_pending && t - row.last_seen_at > IDLE);
  if (expired || !user || user.disabled || user.passwordChangedAt > row.created_at) {
    db().prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  // Touch at most once a minute.
  if (t - row.last_seen_at > 60_000) db().prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(t, id);
  return { row, user };
}

/** The signed-in user (fully authenticated, 2FA done), or null. */
export async function currentUser(): Promise<User | null> {
  const s = await currentRow();
  return s && !s.row.mfa_pending ? s.user : null;
}

export async function currentSession(): Promise<Session | null> {
  const s = await currentRow();
  return s ? toSession(s.row) : null;
}

/** A session that passed the password step and is waiting for a 2FA code. */
export async function pendingMfa(): Promise<{ session: Session; user: User } | null> {
  const s = await currentRow();
  return s && s.row.mfa_pending ? { session: toSession(s.row), user: s.user } : null;
}

export async function endSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE id = ?").run(sha256(token));
  (await cookies()).delete(COOKIE);
}

export function listSessions(userId: string): Session[] {
  return (db().prepare("SELECT * FROM sessions WHERE user_id = ? AND mfa_pending = 0 AND expires_at > ? ORDER BY last_seen_at DESC").all(userId, now()) as Row[]).map(toSession);
}

export function revokeSession(userId: string, sessionId: string) {
  db().prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(sessionId, userId);
}

export function revokeAllSessions(userId: string, except?: string) {
  db().prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(userId, except ?? "");
}

export function pruneSessions() {
  db().prepare("DELETE FROM sessions WHERE expires_at < ? OR (mfa_pending = 0 AND last_seen_at < ?)").run(now(), now() - IDLE);
}

/* ------------------------------------------------------------------ */
/* Guards — call at the top of every admin page, action and route      */
/* ------------------------------------------------------------------ */

export class Forbidden extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

/** For pages: redirects to the login page if not signed in, or to change-password if required. */
export async function requireUserPage(opts: { allowPasswordChange?: boolean } = {}): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/chewy/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/chewy/password");
  return user;
}

export async function requireOwnerPage(): Promise<User> {
  const user = await requireUserPage();
  if (user.role !== "owner") redirect("/chewy?denied=1");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Forbidden("Your session has ended. Sign in again.");
  if (user.mustChangePassword) throw new Forbidden("Change your password before doing anything else.");
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "owner") throw new Forbidden("Only owners can do that.");
  return user;
}
