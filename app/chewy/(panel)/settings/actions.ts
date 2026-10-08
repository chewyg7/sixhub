"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { bool, csv, httpsUrl, isoDate, lines, run, str, type ActionState } from "@/lib/admin/action";
import * as repo from "@/lib/db/content";

export async function saveRelease(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const release = { date: isoDate.parse(str(f, "date")), platforms: z.array(z.string().max(40)).min(1).max(8).parse(csv(f, "platforms")) };
    const launchMode = z.enum(["auto", "launched", "countdown"]).parse(str(f, "launchMode"));
    repo.saveSettings("release", release);
    repo.saveSettings("launchMode", launchMode);
    await audit(user, "settings.release", null, { ...release, launchMode });
    return "Release settings saved. The countdown updates for everyone right away.";
  });
}

export async function saveSocials(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const opt = (k: string) => (str(f, k) ? httpsUrl.parse(str(f, k)) : "");
    const socials = { discord: opt("discord"), x: opt("x"), instagram: opt("instagram") };
    repo.saveSettings("socials", socials);
    await audit(user, "settings.socials", null, socials);
    return "Social links saved.";
  });
}

export async function saveAnnouncement(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const href = str(f, "href");
    const a = { enabled: bool(f, "enabled"), text: z.string().max(200).parse(str(f, "text")), href: href ? (href.startsWith("/") ? z.string().max(300).parse(href) : httpsUrl.parse(href)) : "" };
    if (a.enabled && !a.text) throw new Error("Write the announcement text first.");
    repo.saveSettings("announcement", a);
    await audit(user, "settings.announcement", null, a);
    return a.enabled ? "Announcement is live." : "Announcement saved (hidden).";
  });
}

export async function saveHome(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const must = (slug: string, what: string) => {
      if (slug && !repo.mediaSlugExists(slug)) throw new Error(`${what}: no media item “${slug}”.`);
      return slug;
    };
    const home = {
      playSlug: must(str(f, "playSlug"), "Hero trailer"),
      galleryCollection: str(f, "galleryCollection"),
      viewerStill: must(str(f, "viewerStill"), "Viewer still"),
      viewerPicks: lines(f, "viewerPicks").map((s) => must(s, "Viewer picks")),
    };
    repo.saveSettings("home", home);
    await audit(user, "settings.home", null, home);
    return "Home page picks saved.";
  });
}
