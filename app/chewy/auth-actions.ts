"use server";

import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { audit } from "@/lib/auth/audit";
import { decrypt, sha256 } from "@/lib/auth/crypto";
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/request";
import { isBlockedIp } from "@/lib/auth/security";
import { createSession, currentUser, endSession, pendingMfa } from "@/lib/auth/session";
import { clearKey, formatWait, ipKey, LIMITS, lockedFor, mfaKey, recordFailure, userKey, pruneThrottle } from "@/lib/auth/throttle";
import { normalizeRecovery, verifyTotp } from "@/lib/auth/totp";
import { getAuthRecord, getAuthRecordById, markLogin, rehashPassword, setPassword, setRecoveryHashes, setTotpLastStep } from "@/lib/auth/users";

export interface FormState {
  error?: string;
  ok?: string;
}

const GENERIC = "That username and password don't match.";
/** Random 250–650 ms so response time doesn't reveal which check failed. */
const jitter = () => new Promise((r) => setTimeout(r, randomInt(250, 650)));

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim().slice(0, 64);
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };
  if (password.length > 256) return { error: GENERIC };

  pruneThrottle();
  const ip = await clientIp();
  if (isBlockedIp(ip)) {
    await audit(null, "login.blocked_ip", username);
    await jitter();
    return { error: GENERIC };
  }
  const wait = Math.max(lockedFor(ipKey(ip)), lockedFor(userKey(username)));
  if (wait) {
    await audit(null, "login.blocked", username);
    return { error: `Too many attempts. Try again in ${formatWait(wait)}.` };
  }

  const rec = getAuthRecord(username);
  // Unknown users still pay for a full hash check, so timing reveals nothing.
  const ok = rec ? await verifyPassword(password, rec.passwordHash) : (await verifyPassword(password, await dummyHash()), false);
  if (!rec || !ok || rec.user.disabled) {
    recordFailure(ipKey(ip), LIMITS.ip);
    recordFailure(userKey(username), LIMITS.user);
    await audit(rec ? { id: rec.user.id, username: rec.user.username } : null, "login.failed", username);
    await jitter();
    return { error: GENERIC };
  }

  clearKey(userKey(username));
  if (needsRehash(rec.passwordHash)) rehashPassword(rec.user.id, await hashPassword(password));
  await createSession(rec.user.id, rec.user.totpEnabled);
  if (rec.user.totpEnabled) {
    await audit(rec.user, "login.password_ok");
    redirect("/chewy/login/verify");
  }
  markLogin(rec.user.id);
  await audit(rec.user, "login");
  redirect(rec.user.mustChangePassword ? "/chewy/password" : "/chewy");
}

export async function verifyMfa(_: FormState, form: FormData): Promise<FormState> {
  const pending = await pendingMfa();
  if (!pending) redirect("/chewy/login");
  const { user } = pending;
  const wait = lockedFor(mfaKey(user.id));
  if (wait) return { error: `Too many attempts. Try again in ${formatWait(wait)}.` };

  const rec = getAuthRecordById(user.id);
  if (!rec?.totpSecret) {
    await endSession();
    redirect("/chewy/login");
  }
  const input = String(form.get("code") ?? "").trim().slice(0, 32);
  let ok = false;
  if (/^\d[\d\s]{5,7}$/.test(input)) {
    const step = verifyTotp(decrypt(rec.totpSecret), input, rec.totpLastStep);
    if (step !== null) {
      setTotpLastStep(user.id, step);
      ok = true;
    }
  } else if (input) {
    const h = sha256(normalizeRecovery(input));
    if (rec.recoveryHashes.includes(h)) {
      setRecoveryHashes(user.id, rec.recoveryHashes.filter((x) => x !== h));
      await audit(user, "login.recovery_code_used", null, { remaining: rec.recoveryHashes.length - 1 });
      ok = true;
    }
  }

  if (!ok) {
    recordFailure(mfaKey(user.id), LIMITS.mfa);
    await audit(user, "login.mfa_failed");
    await jitter();
    if (lockedFor(mfaKey(user.id))) {
      await endSession();
      return { error: "Too many wrong codes. Sign in again later." };
    }
    return { error: "That code didn't work. Check your authenticator app and try again." };
  }

  clearKey(mfaKey(user.id));
  // Swap the half-authenticated session for a brand-new full one.
  await endSession();
  await createSession(user.id, false);
  markLogin(user.id);
  await audit(user, "login");
  redirect(user.mustChangePassword ? "/chewy/password" : "/chewy");
}

export async function logout() {
  const user = await currentUser();
  if (user) await audit(user, "logout");
  await endSession();
  redirect("/chewy/login");
}

/** Change your own password. Signs out every other device. */
export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/chewy/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const rec = getAuthRecordById(user.id);
  if (!rec || current.length > 256 || !(await verifyPassword(current, rec.passwordHash))) {
    recordFailure(userKey(user.username), LIMITS.user);
    await jitter();
    return { error: "Your current password isn't right." };
  }
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (next === current) return { error: "Choose a password you haven't used here." };
  const problem = passwordProblem(next, user.username);
  if (problem) return { error: problem };
  setPassword(user.id, await hashPassword(next));
  await createSession(user.id, false);
  await audit(user, "password.change");
  redirect("/chewy?password=changed");
}
