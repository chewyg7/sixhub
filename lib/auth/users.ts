import "server-only";
import { randomUUID } from "node:crypto";
import { db, fromJson, now, toJson } from "@/lib/db";

export type Role = "owner" | "admin";

export interface UserLinks {
  discord?: string;
  x?: string;
  instagram?: string;
  website?: string;
}

/** A user as the app sees it. Secrets (hashes, TOTP) never leave this module except via explicit getters. */
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  avatarUrl: string | null;
  bio: string;
  links: UserLinks;
  totpEnabled: boolean;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: number;
  passwordChangedAt: number;
  lastLoginAt: number | null;
  createdBy: string | null;
}

interface Row {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  password_hash: string;
  avatar_url: string | null;
  bio: string;
  links: string;
  totp_secret: string | null;
  totp_enabled: number;
  totp_last_step: number;
  recovery_codes: string;
  disabled: number;
  must_change_password: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  password_changed_at: number;
  last_login_at: number | null;
}

const toUser = (r: Row): User => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  role: r.role,
  avatarUrl: r.avatar_url,
  bio: r.bio,
  links: fromJson<UserLinks>(r.links, {}),
  totpEnabled: !!r.totp_enabled,
  disabled: !!r.disabled,
  mustChangePassword: !!r.must_change_password,
  createdAt: r.created_at,
  passwordChangedAt: r.password_changed_at,
  lastLoginAt: r.last_login_at,
  createdBy: r.created_by,
});

const row = (sql: string, ...args: unknown[]) => db().prepare(sql).get(...args) as Row | undefined;

export const getUserById = (id: string) => {
  const r = row("SELECT * FROM users WHERE id = ?", id);
  return r ? toUser(r) : null;
};
export const getUserByUsername = (username: string) => {
  const r = row("SELECT * FROM users WHERE username = ?", username);
  return r ? toUser(r) : null;
};
export const listUsers = () => (db().prepare("SELECT * FROM users ORDER BY role DESC, created_at").all() as Row[]).map(toUser);
export const countOwners = () => (db().prepare("SELECT COUNT(*) n FROM users WHERE role = 'owner' AND disabled = 0").get() as { n: number }).n;

/** Credentials for login checks only. */
export function getAuthRecord(username: string) {
  const r = row("SELECT * FROM users WHERE username = ?", username);
  return r ? { user: toUser(r), passwordHash: r.password_hash, totpSecret: r.totp_secret, totpLastStep: r.totp_last_step, recoveryHashes: fromJson<string[]>(r.recovery_codes, []) } : null;
}
export function getAuthRecordById(id: string) {
  const r = row("SELECT * FROM users WHERE id = ?", id);
  return r ? { user: toUser(r), passwordHash: r.password_hash, totpSecret: r.totp_secret, totpLastStep: r.totp_last_step, recoveryHashes: fromJson<string[]>(r.recovery_codes, []) } : null;
}

export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,24}$/;

export function createUser(u: { username: string; displayName: string; role: Role; passwordHash: string; mustChangePassword: boolean; createdBy: string | null }): User {
  const t = now();
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO users (id, username, display_name, role, password_hash, must_change_password, created_by, created_at, updated_at, password_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, u.username, u.displayName, u.role, u.passwordHash, u.mustChangePassword ? 1 : 0, u.createdBy, t, t, t);
  return getUserById(id)!;
}

export function updateProfile(id: string, p: { displayName: string; bio: string; links: UserLinks; avatarUrl?: string | null }) {
  db()
    .prepare("UPDATE users SET display_name = ?, bio = ?, links = ?, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?")
    .run(p.displayName, p.bio, toJson(p.links), p.avatarUrl === undefined ? null : p.avatarUrl, now(), id);
}
export function clearAvatar(id: string) {
  db().prepare("UPDATE users SET avatar_url = NULL, updated_at = ? WHERE id = ?").run(now(), id);
}

/** Sets a new password; every existing session for the user stops working. */
export function setPassword(id: string, passwordHash: string, mustChange = false) {
  const t = now();
  db().prepare("UPDATE users SET password_hash = ?, must_change_password = ?, password_changed_at = ?, updated_at = ? WHERE id = ?").run(passwordHash, mustChange ? 1 : 0, t, t, id);
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}
export const rehashPassword = (id: string, passwordHash: string) => db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);

export function setRole(id: string, role: Role) {
  db().prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(role, now(), id);
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}
export function setDisabled(id: string, disabled: boolean) {
  db().prepare("UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?").run(disabled ? 1 : 0, now(), id);
  if (disabled) db().prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}
export function deleteUser(id: string) {
  db().prepare("DELETE FROM users WHERE id = ?").run(id);
}
export function markLogin(id: string) {
  db().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now(), id);
}

export function setTotp(id: string, encryptedSecret: string | null, recoveryHashes: string[]) {
  db()
    .prepare("UPDATE users SET totp_secret = ?, totp_enabled = ?, totp_last_step = 0, recovery_codes = ?, updated_at = ? WHERE id = ?")
    .run(encryptedSecret, encryptedSecret ? 1 : 0, toJson(recoveryHashes), now(), id);
}
export const setTotpLastStep = (id: string, step: number) => db().prepare("UPDATE users SET totp_last_step = ? WHERE id = ?").run(step, id);
export const setRecoveryHashes = (id: string, hashes: string[]) => db().prepare("UPDATE users SET recovery_codes = ? WHERE id = ?").run(toJson(hashes), id);
