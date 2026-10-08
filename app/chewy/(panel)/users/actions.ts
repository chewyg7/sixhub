"use server";

import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { hashPassword } from "@/lib/auth/password";
import { requireOwner, revokeAllSessions } from "@/lib/auth/session";
import * as users from "@/lib/auth/users";
import { run, str, type ActionState } from "@/lib/admin/action";

export type TeamState = ActionState & { tempPassword?: string; forUser?: string };

/** A strong temporary password: 18 random characters plus one from each class. */
function tempPassword() {
  const pick = (s: string) => s[randomInt(s.length)];
  const base = randomBytes(18).toString("base64url").slice(0, 18);
  return `${base}${pick("ABCDEFGHJKLMNPQRSTUVWXYZ")}${pick("abcdefghijkmnpqrstuvwxyz")}${pick("23456789")}${pick("!@#$%*-_")}`;
}

/** Never leave the team without an active owner. */
function assertNotLastOwner(id: string) {
  const u = users.getUserById(id);
  if (u?.role === "owner" && !u.disabled && users.countOwners() <= 1) throw new Error("This is the last active owner. Make someone else an owner first.");
}

export async function createMember(_: TeamState, f: FormData): Promise<TeamState> {
  let pw = "";
  let name = "";
  const res = await run(async () => {
    const me = await requireOwner();
    name = z.string().regex(users.USERNAME_RE, "3–24 letters, numbers, dot, dash or underscore").parse(str(f, "username"));
    if (users.getUserByUsername(name)) throw new Error("That username is taken.");
    const role = z.enum(["owner", "admin"]).parse(str(f, "role"));
    pw = tempPassword();
    users.createUser({ username: name, displayName: z.string().min(1).max(60).parse(str(f, "displayName") || name), role, passwordHash: await hashPassword(pw), mustChangePassword: true, createdBy: me.id });
    await audit(me, "user.create", name, { role });
    return `Created @${name}.`;
  }, { revalidate: false });
  return res.error ? res : { ...res, tempPassword: pw, forUser: name };
}

export async function resetMemberPassword(id: string): Promise<TeamState> {
  let pw = "";
  let name = "";
  const res = await run(async () => {
    const me = await requireOwner();
    const u = users.getUserById(id);
    if (!u) throw new Error("User not found.");
    if (u.id === me.id) throw new Error("Change your own password from your profile.");
    name = u.username;
    pw = tempPassword();
    users.setPassword(u.id, await hashPassword(pw), true);
    await audit(me, "user.password.reset", u.username);
    return `New temporary password for @${u.username}. They've been signed out everywhere.`;
  }, { revalidate: false });
  return res.error ? res : { ...res, tempPassword: pw, forUser: name };
}

export async function setMemberRole(id: string, role: "owner" | "admin"): Promise<ActionState> {
  return run(async () => {
    const me = await requireOwner();
    const u = users.getUserById(id);
    if (!u) throw new Error("User not found.");
    if (role === "admin") assertNotLastOwner(id);
    users.setRole(id, z.enum(["owner", "admin"]).parse(role));
    await audit(me, "user.role", u.username, { role });
    return `@${u.username} is now ${role === "owner" ? "an owner" : "an admin"}.${u.id === me.id ? "" : " They've been signed out so the change takes effect."}`;
  }, { revalidate: false });
}

export async function setMemberDisabled(id: string, disabled: boolean): Promise<ActionState> {
  return run(async () => {
    const me = await requireOwner();
    const u = users.getUserById(id);
    if (!u) throw new Error("User not found.");
    if (u.id === me.id) throw new Error("You can't disable yourself.");
    if (disabled) assertNotLastOwner(id);
    users.setDisabled(id, disabled);
    await audit(me, disabled ? "user.disable" : "user.enable", u.username);
    return disabled ? `@${u.username} is disabled and signed out.` : `@${u.username} can sign in again.`;
  }, { revalidate: false });
}

export async function signOutMember(id: string): Promise<ActionState> {
  return run(async () => {
    const me = await requireOwner();
    const u = users.getUserById(id);
    if (!u) throw new Error("User not found.");
    revokeAllSessions(id);
    await audit(me, "user.sessions.revoke", u.username);
    return `Signed @${u.username} out everywhere.`;
  }, { revalidate: false });
}

export async function deleteMember(id: string): Promise<ActionState> {
  return run(async () => {
    const me = await requireOwner();
    const u = users.getUserById(id);
    if (!u) throw new Error("User not found.");
    if (u.id === me.id) throw new Error("You can't delete yourself. Ask another owner.");
    assertNotLastOwner(id);
    users.deleteUser(id);
    await audit(me, "user.delete", u.username);
    return `Deleted @${u.username}. Their uploads stay.`;
  }, { revalidate: false });
}
