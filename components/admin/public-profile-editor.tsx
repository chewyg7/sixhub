"use client";

import Link from "next/link";
import { useActionState, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Pin, Plus, Star, Trash2 } from "lucide-react";
import { savePublicProfile } from "@/app/chewy/(panel)/profile/actions";
import type { ActionState } from "@/lib/admin/action";
import type { ButtonStyle, ProfileLink, ProfileSettings, ProfileTheme } from "@/lib/profiles";
import { cn } from "@/lib/cn";
import { Card, Field, Input, Notice, SubmitButton, Toggle } from "./ui";

export interface PickerItem {
  slug: string;
  title: string;
  thumb: string | null;
}

const THEMES: { id: ProfileTheme; label: string; preview: (h: number) => string }[] = [
  { id: "aurora", label: "Aurora", preview: (h) => `radial-gradient(circle at 20% 20%, hsl(${h} 90% 55%), transparent 60%), radial-gradient(circle at 80% 70%, hsl(${(h + 60) % 360} 90% 60%), transparent 60%), #0d0912` },
  { id: "sunset", label: "Sunset", preview: (h) => `linear-gradient(160deg, hsl(${h} 90% 55%), hsl(${(h + 40) % 360} 95% 60%) 50%, #120a14)` },
  { id: "midnight", label: "Midnight", preview: (h) => `radial-gradient(circle at 50% 0%, hsl(${h} 80% 50% / 0.7), transparent 60%), #0a0c1c` },
  { id: "mono", label: "Mono", preview: () => "linear-gradient(180deg, #2a2a2e, #0a0a0b)" },
];

const STYLES: { id: ButtonStyle; label: string }[] = [
  { id: "glass", label: "Glass" },
  { id: "solid", label: "Solid" },
  { id: "outline", label: "Outline" },
];

let nextId = 0;
const newId = () => `l${Date.now().toString(36)}${(nextId++).toString(36)}`;

const tile = (active: boolean) => cn("relative overflow-hidden rounded-xl border-2 transition-colors", active ? "border-accent" : "border-transparent hover:border-white/30");

/** Everything on a team member's public page (/@username). */
export function PublicProfileEditor({
  targetId,
  username,
  settings,
  banners,
  uploads,
}: {
  targetId: string | null;
  username: string;
  settings: ProfileSettings;
  banners: PickerItem[];
  uploads: PickerItem[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(savePublicProfile.bind(null, targetId), {});
  const [theme, setTheme] = useState(settings.theme);
  const [hue, setHue] = useState(settings.accentHue);
  const [buttonStyle, setButtonStyle] = useState(settings.buttonStyle);
  const [banner, setBanner] = useState(settings.bannerSlug);
  const [links, setLinks] = useState<ProfileLink[]>(settings.links);
  const [pinned, setPinned] = useState<string[]>(settings.pinned);
  const [showAllBanners, setShowAllBanners] = useState(false);

  const patch = (i: number, p: Partial<ProfileLink>) => setLinks((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) =>
    setLinks((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const accent = `hsl(${hue} 95% 62%)`;

  return (
    <Card
      title="Public profile"
      description={`gtasixhub.com/@${username}: a link-in-bio page plus everything added to the archive.`}
      actions={
        <Link href={`/@${username}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-bold hover:bg-white/15">
          <ExternalLink className="size-3.5" /> View page
        </Link>
      }
    >
      <form action={action} className="grid gap-6">
        <Notice tone="success">{state.ok}</Notice>
        <Notice tone="error">{state.error}</Notice>
        <input type="hidden" name="theme" value={theme} />
        <input type="hidden" name="accentHue" value={hue} />
        <input type="hidden" name="buttonStyle" value={buttonStyle} />
        <input type="hidden" name="bannerSlug" value={banner} />
        <input type="hidden" name="links" value={JSON.stringify(links)} />
        <input type="hidden" name="pinned" value={pinned.join("\n")} />

        <div className="grid gap-3">
          <Toggle name="visible" defaultChecked={settings.visible} label="Public page" hint={`Off hides /@${username} and the card on the team page.`} />
          <Toggle name="showContributions" defaultChecked={settings.showContributions} label="Contributions tab" hint="Everything uploaded or imported by this account." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Headline" hint="One line under your name, e.g. “Founder · Archive lead”." className="sm:col-span-2">
            <Input name="headline" defaultValue={settings.headline} maxLength={80} />
          </Field>
          <Field label="Pronouns">
            <Input name="pronouns" defaultValue={settings.pronouns} maxLength={30} placeholder="she/her" />
          </Field>
          <Field label="Location">
            <Input name="location" defaultValue={settings.location} maxLength={50} placeholder="Vice City" />
          </Field>
        </div>

        {/* Look */}
        <div>
          <p className="mb-2 text-[13.5px] font-bold text-white/85">Theme</p>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={theme === t.id} className={tile(theme === t.id)}>
                <span className="block h-16" style={{ background: t.preview(hue) }} />
                <span className="block bg-black/40 py-1.5 text-[12.5px] font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center justify-between text-[13.5px] font-bold text-white/85">
            Accent colour <span className="size-5 rounded-full ring-2 ring-white/20" style={{ background: accent, boxShadow: `0 0 14px ${accent}` }} />
          </p>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            aria-label="Accent colour"
            className="hue-range h-5 w-full cursor-pointer appearance-none bg-transparent"
            style={{ "--thumb": accent } as CSSProperties}
          />
        </div>

        <div>
          <p className="mb-2 text-[13.5px] font-bold text-white/85">Link buttons</p>
          <div className="flex gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setButtonStyle(s.id)}
                aria-pressed={buttonStyle === s.id}
                className={cn("h-9 flex-1 rounded-xl text-[13px] font-bold transition-colors", buttonStyle === s.id ? "bg-white text-[#140c18]" : "bg-white/[0.06] text-white/70 hover:text-white")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13.5px] font-bold text-white/85">Cover image</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button type="button" onClick={() => setBanner("")} aria-pressed={banner === ""} className={tile(banner === "")} title="Gradient">
              <span className="block aspect-video" style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 35%), hsl(${(hue + 50) % 360} 85% 45%))` }} />
            </button>
            {(showAllBanners ? banners : banners.slice(0, 17)).map((b) => (
              <button key={b.slug} type="button" onClick={() => setBanner(b.slug)} aria-pressed={banner === b.slug} className={tile(banner === b.slug)} title={b.title}>
                {/* eslint-disable-next-line @next/next/no-img-element -- archive thumbnail */}
                {b.thumb && <img src={b.thumb} alt="" loading="lazy" className="block aspect-video w-full object-cover" />}
              </button>
            ))}
          </div>
          {!showAllBanners && banners.length > 17 && (
            <button type="button" onClick={() => setShowAllBanners(true)} className="mt-2 text-[12.5px] font-bold text-white/55 hover:text-white">
              Show {banners.length - 17} more
            </button>
          )}
        </div>

        {/* Links */}
        <div>
          <p className="mb-1 text-[13.5px] font-bold text-white/85">Links</p>
          <p className="mb-3 text-[12.5px] text-white/45">Starred links show first, bigger, in your accent colour.</p>
          <div className="grid gap-2">
            {links.map((l, i) => (
              <div key={l.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => patch(i, { featured: !l.featured })}
                  aria-pressed={!!l.featured}
                  aria-label={l.featured ? "Unstar" : "Star (show first)"}
                  title={l.featured ? "Unstar" : "Star"}
                  className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors", l.featured ? "text-[#ffd23f]" : "text-white/35 hover:text-white")}
                >
                  <Star className={cn("size-4", l.featured && "fill-current")} />
                </button>
                <Input aria-label="Label" value={l.label} maxLength={60} placeholder="Label" onChange={(e) => patch(i, { label: e.target.value })} className="max-w-[170px]" />
                <Input aria-label="Link" value={l.url} maxLength={500} placeholder="https://…" onChange={(e) => patch(i, { url: e.target.value })} className="font-mono text-[13px]" />
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 disabled:opacity-25">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === links.length - 1} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 disabled:opacity-25">
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" aria-label="Remove" onClick={() => setLinks((x) => x.filter((_, k) => k !== i))} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-[#ff4d6d]/20 hover:text-[#ff8a9a]">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {links.length < 20 && (
              <button
                type="button"
                onClick={() => setLinks((x) => [...x, { id: newId(), label: "", url: "https://" }])}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-[13.5px] font-bold text-white/60 transition-colors hover:border-white/30 hover:text-white"
              >
                <Plus className="size-4" /> Add link
              </button>
            )}
          </div>
        </div>

        {/* Pinned uploads */}
        {uploads.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-2 text-[13.5px] font-bold text-white/85">
              <Pin className="size-4" /> Pinned uploads <span className="font-normal text-white/45">{pinned.length}/6</span>
            </p>
            <p className="mb-3 text-[12.5px] text-white/45">Shown first on the Contributions tab.</p>
            <div className="no-scrollbar grid max-h-[260px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {uploads.map((u) => {
                const on = pinned.includes(u.slug);
                return (
                  <button
                    key={u.slug}
                    type="button"
                    title={u.title}
                    aria-pressed={on}
                    disabled={!on && pinned.length >= 6}
                    onClick={() => setPinned((p) => (on ? p.filter((s) => s !== u.slug) : [...p, u.slug]))}
                    className={cn(tile(on), "disabled:opacity-30")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- archive thumbnail */}
                    {u.thumb && <img src={u.thumb} alt="" loading="lazy" className="block aspect-square w-full object-cover" />}
                    {on && <Pin className="absolute top-1 right-1 size-4 rounded bg-accent p-0.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <SubmitButton pendingLabel="Saving…">Save public profile</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
