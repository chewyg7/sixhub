"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { verifyPassword } from "@/lib/auth/password";
import { currentSession, requireUser, revokeAllSessions, revokeSession } from "@/lib/auth/session";
import { newRecoveryCodes, verifyTotp } from "@/lib/auth/totp";
import { LIMITS, recordFailure, userKey } from "@/lib/auth/throttle";
import * as users from "@/lib/auth/users";
import { bool, hrefField, jsonField, lines, run, str, type ActionState } from "@/lib/admin/action";
import { Forbidden } from "@/lib/auth/session";
import { getProfileSettings, saveProfileSettings } from "@/lib/profiles";
import { mediaSlugExists } from "@/lib/db/content";
import { revalidatePath } from "next/cache";

export type SecurityState = ActionState & { recoveryCodes?: string[] };

const optionalUrl = z.union([z.literal(""), z.string().url().max(300)]);

/** You can edit your own profile; owners can edit anyone's. */
async function profileTarget(targetId: string | null) {
  const user = await requireUser();
  if (!targetId || targetId === user.id) return { user, target: user };
  if (user.role !== "owner") throw new Forbidden("You can only edit your own profile.");
  const target = users.getUserById(targetId);
  if (!target) throw new Error("That team member no longer exists.");
  return { user, target };
}

export async function saveProfile(targetId: string | null, _: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, target } = await profileTarget(targetId);
    users.updateProfile(target.id, {
      displayName: z.string().min(1).max(60).parse(str(f, "displayName")),
      bio: z.string().max(500).parse(str(f, "bio")),
      links: {
        discord: z.string().max(60).parse(str(f, "discord")),
        x: optionalUrl.parse(str(f, "x")),
        instagram: optionalUrl.parse(str(f, "instagram")),
        website: optionalUrl.parse(str(f, "website")),
      },
      avatarUrl: target.avatarUrl,
    });
    await audit(user, "profile.edit", target.id === user.id ? null : target.username);
    revalidatePath("/team");
    return "Profile saved.";
  }, { revalidate: false });
}

export async function removeAvatar(targetId: string | null): Promise<ActionState> {
  return run(async () => {
    const { user, target } = await profileTarget(targetId);
    users.clearAvatar(target.id);
    await audit(user, "profile.avatar.remove", target.id === user.id ? null : target.username);
    return "Photo removed.";
  }, { revalidate: false });
}

const PROFILE_LINK = z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(1, "Every link needs a label").max(60), url: hrefField, featured: z.boolean().optional() });

/** The public page at /@username: look, details, links and pinned uploads. */
export async function savePublicProfile(targetId: string | null, _: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, target } = await profileTarget(targetId);
    const banner = str(f, "bannerSlug");
    if (banner && !mediaSlugExists(banner)) throw new Error("That cover image isn't in the archive any more.");
    const pinned = lines(f, "pinned").slice(0, 6);
    saveProfileSettings(target.id, {
      ...getProfileSettings(target.id),
      visible: bool(f, "visible"),
      showContributions: bool(f, "showContributions"),
      headline: z.string().trim().max(80).parse(str(f, "headline")),
      pronouns: z.string().trim().max(30).parse(str(f, "pronouns")),
      location: z.string().trim().max(50).parse(str(f, "location")),
      accentHue: z.coerce.number().int().min(0).max(360).parse(str(f, "accentHue") || "325"),
      theme: z.enum(["aurora", "sunset", "midnight", "mono"]).parse(str(f, "theme")),
      buttonStyle: z.enum(["glass", "solid", "outline"]).parse(str(f, "buttonStyle")),
      bannerSlug: banner,
      links: jsonField(f, "links", z.array(PROFILE_LINK).max(20, "Up to 20 links")),
      pinned: pinned.filter(mediaSlugExists),
    });
    await audit(user, "profile.public.edit", target.username);
    revalidatePath("/team");
    return `Saved. Live at /@${target.username}`;
  }, { revalidate: false });
}

async function checkPassword(userId: string, username: string, pw: string) {
  const rec = users.getAuthRecordById(userId);
  if (!rec || pw.length > 256 || !(await verifyPassword(pw, rec.passwordHash))) {
    recordFailure(userKey(username), LIMITS.user);
    throw new Error("Your password isn't right.");
  }
  return rec;
}

/** Turns on 2FA after the user proves their app produces the right code for the secret shown. */
export async function enableTotp(_: SecurityState, f: FormData): Promise<SecurityState> {
  let codes: string[] = [];
  const res = await run(async () => {
    const user = await requireUser();
    if (user.totpEnabled) throw new Error("Two-factor authentication is already on.");
    const secret = z
      .string()
      .regex(/^[A-Z2-7]{32}$/, "Setup expired. Reload the page.")
      .parse(str(f, "secret"));
    const step = verifyTotp(secret, str(f, "code"), 0);
    if (step === null) throw new Error("That code didn't match. Make sure your phone's clock is right and try the newest code.");
    const rc = newRecoveryCodes();
    users.setTotp(user.id, encrypt(secret), rc.hashes);
    users.setTotpLastStep(user.id, step);
    // Other sessions were authenticated without 2FA; end them.
    const s = await currentSession();
    revokeAllSessions(user.id, s?.id);
    codes = rc.codes;
    await audit(user, "2fa.enable");
    return "Two-factor authentication is on. Save your recovery codes now.";
  }, { revalidate: false });
  return res.error ? res : { ...res, recoveryCodes: codes };
}

export async function disableTotp(_: SecurityState, f: FormData): Promise<SecurityState> {
  return run(async () => {
    const user = await requireUser();
    const rec = await checkPassword(user.id, user.username, str(f, "password"));
    if (!rec.totpSecret) throw new Error("Two-factor authentication is already off.");
    if (verifyTotp(decrypt(rec.totpSecret), str(f, "code"), rec.totpLastStep) === null) throw new Error("That code didn't match.");
    users.setTotp(user.id, null, []);
    await audit(user, "2fa.disable");
    return "Two-factor authentication is off.";
  }, { revalidate: false });
}

export async function regenerateRecovery(_: SecurityState, f: FormData): Promise<SecurityState> {
  let codes: string[] = [];
  const res = await run(async () => {
    const user = await requireUser();
    await checkPassword(user.id, user.username, str(f, "password"));
    if (!user.totpEnabled) throw new Error("Turn on two-factor authentication first.");
    const rc = newRecoveryCodes();
    users.setRecoveryHashes(user.id, rc.hashes);
    codes = rc.codes;
    await audit(user, "2fa.recovery.regenerate");
    return "New recovery codes. The old ones no longer work.";
  }, { revalidate: false });
  return res.error ? res : { ...res, recoveryCodes: codes };
}

export async function revokeMySession(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    revokeSession(user.id, id);
    await audit(user, "session.revoke");
    return "Signed out that device.";
  }, { revalidate: false });
}

export async function revokeOtherSessions(): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const s = await currentSession();
    revokeAllSessions(user.id, s?.id);
    await audit(user, "session.revoke_others");
    return "Signed out every other device.";
  }, { revalidate: false });
}
