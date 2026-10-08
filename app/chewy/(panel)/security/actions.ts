"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/auth/audit";
import { currentSession, requireOwner } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/request";
import { blockIp, clearAllThrottle, clearThrottleKey, revokeAllExcept, revokeSessionById, unblockIp } from "@/lib/auth/security";
import { run, str, type ActionState } from "@/lib/admin/action";

const done = (msg: string) => {
  revalidatePath("/chewy/security");
  return msg;
};

export async function revokeSessionAction(id: string): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const mine = await currentSession();
      if (mine?.id === id) throw new Error("That's this session. Use Sign out instead.");
      revokeSessionById(id);
      await audit(user, "security.session.revoke", id.slice(0, 12));
      return done("Session ended.");
    },
    { revalidate: false },
  );
}

export async function signOutEveryone(): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const mine = await currentSession();
      const n = revokeAllExcept(mine?.id ?? "");
      await audit(user, "security.session.revoke_all", null, { ended: n });
      return done(`Signed out ${n} other session${n === 1 ? "" : "s"}. Everyone else has to sign in again.`);
    },
    { revalidate: false },
  );
}

export async function unlockAction(key: string): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      clearThrottleKey(key);
      await audit(user, "throttle.unlock", key);
      return done(`Unlocked ${key.replace(/^(\w+):/, "$1 ")}.`);
    },
    { revalidate: false },
  );
}

export async function unlockAll(): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const n = clearAllThrottle();
      await audit(user, "throttle.unlock_all", null, { cleared: n });
      return done("All sign-in locks and failure counts cleared.");
    },
    { revalidate: false },
  );
}

export async function blockIpAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      const ip = str(f, "ip");
      if (ip === (await clientIp())) throw new Error("That's your own IP address. Blocking it would lock you out.");
      blockIp(ip, str(f, "note"), user.username);
      await audit(user, "security.ip.block", ip);
      return done(`${ip} can no longer sign in.`);
    },
    { revalidate: false },
  );
}

export async function unblockIpAction(ip: string): Promise<ActionState> {
  return run(
    async () => {
      const user = await requireOwner();
      unblockIp(ip);
      await audit(user, "security.ip.unblock", ip);
      return done(`${ip} unblocked.`);
    },
    { revalidate: false },
  );
}
