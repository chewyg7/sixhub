"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil } from "lucide-react";
import { saveTeamPage } from "@/app/chewy/(panel)/team-page/actions";
import type { TeamPageSettings } from "@/lib/profiles";
import { cn } from "@/lib/cn";
import { ActionForm, Badge, Field, Input, Textarea, Toggle } from "./ui";
import { Avatar } from "./shell";

export interface TeamRow {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "admin";
  avatarUrl: string | null;
  publicProfile: boolean;
  disabled: boolean;
  teamRole: string;
  blurb: string;
  hidden: boolean;
}

/** Owners edit the /team page: the words on it, and each member's card. */
export function TeamPageEditor({ settings, rows }: { settings: TeamPageSettings; rows: TeamRow[] }) {
  const [members, setMembers] = useState(rows);
  const patch = (id: string, p: Partial<TeamRow>) => setMembers((m) => m.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) =>
    setMembers((m) => {
      const j = i + d;
      if (j < 0 || j >= m.length) return m;
      const n = [...m];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <ActionForm
      action={saveTeamPage}
      title="Team page"
      description="Owners appear first, then everyone else, each group in the order below."
      submit="Save team page"
      footer={
        <Link href="/team" target="_blank" className="text-[13.5px] font-bold text-accent-text">
          View /team
        </Link>
      }
    >
      <input type="hidden" name="members" value={JSON.stringify(members.map((m) => ({ id: m.id, role: m.teamRole, blurb: m.blurb, hidden: m.hidden })))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Small label">
          <Input name="kicker" defaultValue={settings.kicker} maxLength={40} />
        </Field>
        <Field label="Title">
          <Input name="title" defaultValue={settings.title} maxLength={90} required />
        </Field>
        <Field label="Introduction" className="sm:col-span-2">
          <Textarea name="intro" defaultValue={settings.intro} maxLength={800} />
        </Field>
        <Field label="Owners heading">
          <Input name="ownersHeading" defaultValue={settings.ownersHeading} maxLength={40} />
        </Field>
        <Field label="Team heading">
          <Input name="teamHeading" defaultValue={settings.teamHeading} maxLength={40} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13.5px] font-bold text-white/85">People</p>
        <ol className="grid gap-2">
          {members.map((m, i) => (
            <li key={m.id} className={cn("rounded-2xl border p-3 transition-opacity", m.hidden || m.disabled || !m.publicProfile ? "border-dashed border-white/10 opacity-60" : "border-white/12 bg-white/[0.02]")}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={m} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-bold">
                    {m.displayName} <span className="font-normal text-white/45">@{m.username}</span>
                    <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
                    {m.disabled && <Badge tone="bad">Disabled</Badge>}
                    {!m.publicProfile && <Badge tone="warn">Profile hidden</Badge>}
                  </p>
                </div>
                <Link href={`/chewy/profile?user=${m.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold text-white/60 hover:bg-white/10 hover:text-white">
                  <Pencil className="size-3.5" /> Profile
                </Link>
                <button type="button" onClick={() => patch(m.id, { hidden: !m.hidden })} aria-label={m.hidden ? "Show on the team page" : "Hide from the team page"} title={m.hidden ? "Hidden" : "Shown"} className="flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10">
                  {m.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 disabled:opacity-25">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === members.length - 1} aria-label="Move down" className="flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 disabled:opacity-25">
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr]">
                <Input aria-label={`${m.displayName}'s title`} value={m.teamRole} maxLength={60} placeholder="Title, e.g. Founder" onChange={(e) => patch(m.id, { teamRole: e.target.value })} />
                <Input aria-label={`About ${m.displayName}`} value={m.blurb} maxLength={400} placeholder="A sentence about them (their bio is used if empty)" onChange={(e) => patch(m.id, { blurb: e.target.value })} />
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Closing title">
          <Input name="closingTitle" defaultValue={settings.closingTitle} maxLength={60} />
        </Field>
        <Field label="Sign-off">
          <Input name="signoff" defaultValue={settings.signoff} maxLength={80} />
        </Field>
        <Field label="Closing message" className="sm:col-span-2">
          <Textarea name="closing" defaultValue={settings.closing} maxLength={1000} />
        </Field>
      </div>
      <Toggle name="showJoin" defaultChecked={settings.showJoin} label="“Hang out with us on Discord” button" />
    </ActionForm>
  );
}
