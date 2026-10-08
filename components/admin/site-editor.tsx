"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { resetSite, saveFooter, saveMarquee, saveNavigation, saveSections, saveSeo } from "@/app/chewy/(panel)/site/actions";
import { SECTION_META } from "@/data/settings";
import type { HomeSection, SiteContent, SiteLink } from "@/types/content";
import { cn } from "@/lib/cn";
import { ActionForm, ConfirmButton, Field, Input, Notice, Textarea, useAction } from "./ui";

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function IconBtn({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25",
        danger && "hover:bg-[#ff4d6d]/20 hover:text-[#ff8a9a]",
      )}
    >
      {children}
    </button>
  );
}

/** Home page blocks: switch on/off, reorder, rename headings. */
function SectionsEditor({ initial }: { initial: HomeSection[] }) {
  const [sections, setSections] = useState(initial);
  const patch = (i: number, p: Partial<HomeSection>) => setSections((s) => s.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <>
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />
      <ol className="grid gap-2">
        {sections.map((s, i) => {
          const meta = SECTION_META[s.id];
          return (
            <li key={s.id} className={cn("rounded-2xl border p-3 transition-colors", s.enabled ? "border-white/12 bg-white/[0.03]" : "border-dashed border-white/10 opacity-60")}>
              <div className="flex items-center gap-2">
                <span className="tabular w-6 text-center text-[12px] font-bold text-white/35">{i + 1}</span>
                <span className="flex-1 text-[14.5px] font-bold">{meta.label}</span>
                <IconBtn label={s.enabled ? "Hide this section" : "Show this section"} onClick={() => patch(i, { enabled: !s.enabled })}>
                  {s.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </IconBtn>
                <IconBtn label="Move up" onClick={() => setSections((x) => move(x, i, -1))} disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </IconBtn>
                <IconBtn label="Move down" onClick={() => setSections((x) => move(x, i, 1))} disabled={i === sections.length - 1}>
                  <ArrowDown className="size-4" />
                </IconBtn>
              </div>
              {meta.heading && s.enabled && (
                <div className="mt-3 grid gap-2 pl-8 sm:grid-cols-[1fr_1.4fr]">
                  <Input aria-label={`${meta.label} label`} value={s.kicker} maxLength={60} placeholder="Small label" onChange={(e) => patch(i, { kicker: e.target.value })} />
                  <Input aria-label={`${meta.label} heading`} value={s.title} maxLength={80} placeholder="Heading" onChange={(e) => patch(i, { title: e.target.value })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** An ordered list of label + link rows. */
function LinkList({ name, initial, max }: { name: string; initial: SiteLink[]; max: number }) {
  const [links, setLinks] = useState(initial);
  const patch = (i: number, p: Partial<SiteLink>) => setLinks((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(links)} />
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input aria-label="Label" value={l.label} maxLength={40} placeholder="Label" onChange={(e) => patch(i, { label: e.target.value })} className="max-w-[180px]" />
          <Input aria-label="Link" value={l.href} maxLength={500} placeholder="/media or https://…" onChange={(e) => patch(i, { href: e.target.value })} className="font-mono text-[13px]" />
          <IconBtn label="Move up" onClick={() => setLinks((x) => move(x, i, -1))} disabled={i === 0}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => setLinks((x) => move(x, i, 1))} disabled={i === links.length - 1}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn label="Remove" danger onClick={() => setLinks((x) => x.filter((_, k) => k !== i))} disabled={links.length === 1}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      ))}
      {links.length < max && (
        <button
          type="button"
          onClick={() => setLinks((x) => [...x, { label: "", href: "/" }])}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-[13.5px] font-bold text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          <Plus className="size-4" /> Add link
        </button>
      )}
    </div>
  );
}

export function SiteEditor({ site }: { site: SiteContent }) {
  const [pending, result, act] = useAction();
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ActionForm action={saveSections} title="Home page layout" description="Show, hide and reorder the blocks under the hero, and change their headings.">
          <SectionsEditor initial={site.sections} />
        </ActionForm>

        <div className="grid content-start gap-6">
          <ActionForm action={saveNavigation} title="Navigation" description="Links in the header bar and the big links in the full-screen menu.">
            <p className="text-[13.5px] font-bold text-white/85">Header bar</p>
            <LinkList name="nav" initial={site.nav} max={8} />
            <p className="mt-2 text-[13.5px] font-bold text-white/85">Menu</p>
            <LinkList name="menu" initial={site.menu} max={10} />
          </ActionForm>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ActionForm action={saveSeo} title="Search & sharing" description="The default title and description used by Google, Discord, X and iMessage previews.">
          <Field label="Site title">
            <Input name="title" defaultValue={site.title} maxLength={90} required />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={site.description} maxLength={300} required />
          </Field>
        </ActionForm>

        <ActionForm action={saveFooter} title="Footer">
          <Field label="Big headline">
            <Input name="headline" defaultValue={site.footer.headline} maxLength={40} required />
          </Field>
          <Field label="Tagline">
            <Textarea name="tagline" defaultValue={site.footer.tagline} maxLength={200} className="min-h-20" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Button text">
              <Input name="ctaLabel" defaultValue={site.footer.ctaLabel} maxLength={30} required />
            </Field>
            <Field label="Button link">
              <Input name="ctaHref" defaultValue={site.footer.ctaHref} maxLength={500} required className="font-mono text-[13px]" />
            </Field>
          </div>
        </ActionForm>

        <ActionForm action={saveMarquee} title="Scrolling band" description="The big words that scroll past at the bottom of the home page.">
          <Field label="Words (one per line)" hint="{date} becomes the release date, e.g. “November 19”.">
            <Textarea name="marquee" defaultValue={site.marquee.join("\n")} className="font-mono text-[13px]" />
          </Field>
        </ActionForm>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ConfirmButton confirmLabel="Reset everything here" onConfirm={() =>
            act(async () => {
              const r = await resetSite();
              // The editors hold their own copies of the old values; reload to show the defaults.
              if (r.ok) window.location.reload();
              return r;
            })
          } disabled={pending}>
          Reset site editor to defaults
        </ConfirmButton>
        <Notice tone="success">{result.ok}</Notice>
        <Notice tone="error">{result.error}</Notice>
      </div>
    </div>
  );
}
