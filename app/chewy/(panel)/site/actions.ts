"use server";

import { z } from "zod";
import { audit } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/session";
import { hrefField, jsonField, lines, run, str, type ActionState } from "@/lib/admin/action";
import { DEFAULT_SETTINGS } from "@/data/settings";
import * as repo from "@/lib/db/content";

const text = (max: number) => z.string().trim().max(max);
const link = z.object({ label: text(40).min(1, "Every link needs a label"), href: hrefField });
const SECTION_IDS = DEFAULT_SETTINGS.site.sections.map((s) => s.id) as [string, ...string[]];

/** Saves part of the site content, keeping the rest. */
function patchSite(patch: Partial<ReturnType<typeof repo.getSettings>["site"]>) {
  repo.saveSettings("site", { ...repo.getSettings().site, ...patch });
}

export async function saveSeo(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const seo = { title: text(90).min(1, "Add a title").parse(str(f, "title")), description: text(300).min(1, "Add a description").parse(str(f, "description")) };
    patchSite(seo);
    await audit(user, "site.seo", null, seo);
    return "Search & sharing text saved.";
  });
}

export async function saveSections(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const sections = jsonField(
      f,
      "sections",
      z
        .array(z.object({ id: z.enum(SECTION_IDS), enabled: z.boolean(), kicker: text(60), title: text(80) }))
        .length(SECTION_IDS.length)
        .refine((a) => new Set(a.map((s) => s.id)).size === a.length, "Each section can appear once"),
    ) as ReturnType<typeof repo.getSettings>["site"]["sections"];
    patchSite({ sections });
    await audit(user, "site.sections", null, { order: sections.map((s) => `${s.id}${s.enabled ? "" : " (off)"}`) });
    return "Home page layout saved.";
  });
}

export async function saveMarquee(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const marquee = z.array(text(40)).max(12).parse(lines(f, "marquee"));
    patchSite({ marquee: marquee.length ? marquee : DEFAULT_SETTINGS.site.marquee });
    await audit(user, "site.marquee", null, { marquee });
    return "Scrolling band saved.";
  });
}

export async function saveNavigation(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const nav = jsonField(f, "nav", z.array(link).min(1, "Keep at least one header link").max(8, "Up to 8 header links fit"));
    const menu = jsonField(f, "menu", z.array(link).min(1, "Keep at least one menu link").max(10, "Up to 10 menu links fit"));
    patchSite({ nav, menu });
    await audit(user, "site.navigation", null, { nav: nav.map((l) => l.label), menu: menu.map((l) => l.label) });
    return "Navigation saved.";
  });
}

export async function saveFooter(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    const footer = {
      headline: text(40).min(1).parse(str(f, "headline")),
      tagline: text(200).parse(str(f, "tagline")),
      ctaLabel: text(30).min(1).parse(str(f, "ctaLabel")),
      ctaHref: hrefField.parse(str(f, "ctaHref")),
    };
    patchSite({ footer });
    await audit(user, "site.footer", null, footer);
    return "Footer saved.";
  });
}

export async function resetSite(): Promise<ActionState> {
  return run(async () => {
    const user = await requireOwner();
    repo.saveSettings("site", DEFAULT_SETTINGS.site);
    await audit(user, "site.reset");
    return "Site editor reset to the defaults.";
  });
}
