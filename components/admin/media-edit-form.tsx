"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteMediaAndReturn, saveMedia } from "@/app/chewy/(panel)/media/actions";
import type { ActionState } from "@/lib/admin/action";
import type { FolderOption } from "@/lib/admin/folders";
import { cn } from "@/lib/cn";
import { Card, ConfirmButton, Field, Input, Notice, Select, SubmitButton, Textarea, Toggle } from "./ui";

interface Values {
  title: string;
  slug: string;
  description: string;
  alt: string;
  category: string;
  folderId: string;
  sourceSlug: string;
  datePublished: string;
  tags: string;
  characters: string[];
  locations: string[];
  credit: string;
  officialUrl: string;
  verification: string;
  downloadable: boolean;
  hidden: boolean;
}

/** Tap-to-toggle chips that submit as repeated form values. */
export function ChipPicker({ name, options, initial, disabled }: { name: string; options: { slug: string; name: string }[]; initial: string[]; disabled?: boolean }) {
  const [picked, setPicked] = useState(new Set(initial));
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = picked.has(o.slug);
        return (
          <button
            key={o.slug}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() =>
              setPicked((s) => {
                const n = new Set(s);
                if (on) n.delete(o.slug);
                else n.add(o.slug);
                return n;
              })
            }
            className={cn("h-9 rounded-full border px-3.5 text-[13px] font-bold transition-colors disabled:opacity-50", on ? "border-accent bg-accent/20 text-white" : "border-white/12 text-white/60 hover:text-white")}
          >
            {o.name}
          </button>
        );
      })}
      {[...picked].map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
    </div>
  );
}

export function MediaEditForm({
  slug,
  values: v,
  canEdit,
  owner,
  folders,
  categories,
  sources,
  characters,
  locations,
}: {
  slug: string;
  values: Values;
  canEdit: boolean;
  owner: boolean;
  folders: FolderOption[];
  categories: { slug: string; label: string }[];
  sources: { slug: string; label: string }[];
  characters: { slug: string; name: string }[];
  locations: { slug: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveMedia.bind(null, slug), {});
  const [deleting, startDelete] = useTransition();
  const [delError, setDelError] = useState<string>();

  return (
    <form action={action} className="grid content-start gap-6">
      <Notice tone="success">{state.ok}</Notice>
      <Notice tone="error">{state.error ?? delError}</Notice>
      <fieldset disabled={!canEdit} className="grid gap-6">
        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" defaultValue={v.title} required maxLength={160} />
            </Field>
            {owner && (
              <Field label="URL slug" hint={`gtasixhub.com/media/${v.slug}. Changing it updates collections and folder covers too.`} className="sm:col-span-2">
                <Input name="slug" defaultValue={v.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
              </Field>
            )}
            <Field label="Description" className="sm:col-span-2">
              <Textarea name="description" defaultValue={v.description} maxLength={4000} />
            </Field>
            <Field label="Alt text" hint="Describe what's visible, for screen readers." className="sm:col-span-2">
              <Input name="alt" defaultValue={v.alt} maxLength={400} />
            </Field>
            <Field label="Folder">
              <Select name="folderId" defaultValue={v.folderId}>
                <option value="">(No folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select name="category" defaultValue={v.category}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Select name="sourceSlug" defaultValue={v.sourceSlug}>
                {sources.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Published">
              <Input name="datePublished" type="date" defaultValue={v.datePublished} required />
            </Field>
            <Field label="Tags" hint="Comma separated." className="sm:col-span-2">
              <Input name="tags" defaultValue={v.tags} maxLength={1500} />
            </Field>
          </div>
        </Card>

        <Card title="Who and where" description="Links the item to character and location pages.">
          <p className="mb-2 text-[13.5px] font-bold text-white/80">Characters</p>
          <ChipPicker name="characters" options={characters} initial={v.characters} disabled={!canEdit} />
          <p className="mt-5 mb-2 text-[13.5px] font-bold text-white/80">Locations</p>
          <ChipPicker name="locations" options={locations} initial={v.locations} disabled={!canEdit} />
        </Card>

        <Card title="Rights & visibility">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Credit">
              <Input name="credit" defaultValue={v.credit} maxLength={120} placeholder="Rockstar Games" />
            </Field>
            <Field label="Trust level">
              <Select name="verification" defaultValue={v.verification}>
                <option value="official">Official (Rockstar)</option>
                <option value="reported">Reported (press)</option>
                <option value="community">Community made</option>
              </Select>
            </Field>
            <Field label="Related official link" className="sm:col-span-2">
              <Input name="officialUrl" type="url" defaultValue={v.officialUrl} maxLength={500} placeholder="https://www.rockstargames.com/VI" />
            </Field>
            <div className="grid gap-4 sm:col-span-2">
              <Toggle name="downloadable" defaultChecked={v.downloadable} label="Allow downloads" hint="Shows a download button with the original file." />
              {owner && <Toggle name="hidden" defaultChecked={v.hidden} label="Hide from the site" hint="Keeps the item in the admin panel only." />}
            </div>
          </div>
        </Card>
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          <ConfirmButton
            disabled={deleting}
            confirmLabel="Delete forever"
            onConfirm={() =>
              startDelete(async () => {
                const res = await deleteMediaAndReturn(slug);
                if (res?.error) setDelError(res.error);
              })
            }
          >
            Delete item
          </ConfirmButton>
        </div>
      )}
    </form>
  );
}
