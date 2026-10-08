"use client";

import { saveAnnouncement, saveHome, saveMaintenance, saveRelease, saveSocials } from "@/app/chewy/(panel)/settings/actions";
import type { SiteSettings } from "@/types/content";
import { ActionForm, Field, Input, Select, Textarea, Toggle } from "./ui";

const Form = ActionForm;

export function SettingsForms({ settings: s, videos, collections }: { settings: SiteSettings; videos: { value: string; label: string }[]; collections: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Form action={saveRelease} title="Release & launch" description="The game unlocks at midnight on this date in each time zone; the countdown and launch celebration follow it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Release date">
            <Input name="date" type="date" defaultValue={s.release.date} required />
          </Field>
          <Field label="Platforms" hint="Comma separated.">
            <Input name="platforms" defaultValue={s.release.platforms.join(", ")} required />
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13.5px] font-bold text-white/85">Launch mode</legend>
          {[
            { v: "auto", t: "Automatic", d: "Count down, then celebrate as each time zone reaches midnight." },
            { v: "launched", t: "Force “out now”", d: "Show the launch celebration to everyone now, e.g. to preview it." },
            { v: "countdown", t: "Hold the countdown", d: "Keep showing the countdown even after the date (if it slips)." },
          ].map((o) => (
            <label key={o.v} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 p-3.5 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="radio" name="launchMode" value={o.v} defaultChecked={s.launchMode === o.v} className="mt-1 accent-[#ff4fa3]" />
              <span>
                <span className="block text-[14px] font-bold">{o.t}</span>
                <span className="block text-[13px] text-white/55">{o.d}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-[13px] text-white/45">
          Tip: anyone can preview the celebration without changing anything by opening <code className="text-white/70">/?launch=preview</code>.
        </p>
      </Form>

      <Form action={saveSocials} title="Social links" description="Shown in the footer, menu and FAQ.">
        <Field label="Discord invite">
          <Input name="discord" type="url" defaultValue={s.socials.discord} placeholder="https://discord.gg/…" />
        </Field>
        <Field label="X (Twitter)">
          <Input name="x" type="url" defaultValue={s.socials.x} placeholder="https://x.com/…" />
        </Field>
        <Field label="Instagram">
          <Input name="instagram" type="url" defaultValue={s.socials.instagram} placeholder="https://www.instagram.com/…" />
        </Field>
      </Form>

      <Form
        action={saveMaintenance}
        title="Maintenance mode"
        description="Covers the public site with a message, e.g. while you reorganise things. You (and anyone signed in here) still see the site normally."
      >
        <Toggle name="enabled" defaultChecked={s.maintenance.enabled} label="Turn maintenance mode on" hint="The admin panel always stays available." />
        <Field label="Heading">
          <Input name="title" defaultValue={s.maintenance.title} maxLength={60} required />
        </Field>
        <Field label="Message">
          <Textarea name="message" defaultValue={s.maintenance.message} maxLength={500} />
        </Field>
      </Form>

      <Form action={saveAnnouncement} title="Announcement banner" description="A short message across the top of every page.">
        <Toggle name="enabled" defaultChecked={s.announcement.enabled} label="Show the banner" />
        <Field label="Text">
          <Input name="text" defaultValue={s.announcement.text} maxLength={200} placeholder="Trailer 3 is out now" />
        </Field>
        <Field label="Link (optional)" hint="A page on this site (/media/…) or a full https link.">
          <Input name="href" defaultValue={s.announcement.href} maxLength={300} />
        </Field>
      </Form>

      <Form action={saveHome} title="Home page picks">
        <Field label="Hero “Watch” trailer">
          <Select name="playSlug" defaultValue={s.home.playSlug}>
            {videos.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gallery wall collection">
          <Select name="galleryCollection" defaultValue={s.home.galleryCollection}>
            {collections.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Media Viewer still (media slug)">
          <Input name="viewerStill" defaultValue={s.home.viewerStill} />
        </Field>
        <Field label="Viewer quick picks (one media slug per line)">
          <Textarea name="viewerPicks" defaultValue={s.home.viewerPicks.join("\n")} className="font-mono text-[13px]" />
        </Field>
      </Form>
    </div>
  );
}
