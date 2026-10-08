"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Folder, FolderPlus, Pencil } from "lucide-react";
import { deleteFolderAction, saveFolderAction } from "@/app/chewy/(panel)/folders/actions";
import type { ActionState } from "@/lib/admin/action";
import type { FolderOption } from "@/lib/admin/folders";
import type { MediaFolder } from "@/types/content";
import { cn } from "@/lib/cn";
import { Button, Card, ConfirmButton, Field, Input, Notice, Select, SubmitButton, Textarea } from "./ui";

export type FolderRow = Omit<MediaFolder, "coverSlug"> & { coverSlug: string; items: number };

function FolderForm({ initial, options, onDone }: { initial: Partial<FolderRow>; options: FolderOption[]; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveFolderAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.n, state.ok, router, onDone]);
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-2">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="sm:col-span-2">
        <Notice tone="error">{state.error}</Notice>
      </div>
      <Field label="Name">
        <Input name="name" defaultValue={initial.name} required maxLength={80} autoFocus />
      </Field>
      <Field label="URL name" hint="Left empty, it's made from the name.">
        <Input name="slug" defaultValue={initial.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
      </Field>
      <Field label="Inside">
        <Select name="parentId" defaultValue={initial.parentId ?? ""}>
          <option value="">(Top level)</option>
          {options
            .filter((o) => o.id !== initial.id && !o.label.startsWith(`${options.find((x) => x.id === initial.id)?.label} /`))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Order" hint="Lower numbers come first.">
        <Input name="sort" type="number" min={0} max={10000} defaultValue={initial.sort ?? 0} />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <Textarea name="description" defaultValue={initial.description} maxLength={600} className="min-h-20" />
      </Field>
      <Field label="Cover image (media slug)" hint="Optional. Otherwise the newest item inside is used." className="sm:col-span-2">
        <Input name="coverSlug" defaultValue={initial.coverSlug} maxLength={80} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">{initial.id ? "Save folder" : "Create folder"}</SubmitButton>
        <Button tone="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function FolderManager({ rows, options, unfiled }: { rows: FolderRow[]; options: FolderOption[]; unfiled: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState<Set<string>>(() => new Set(rows.filter((r) => !r.parentId).map((r) => r.id)));
  const [msg, setMsg] = useState<ActionState>({});
  const [busy, start] = useTransition();

  const children = (parent: string | null) => rows.filter((r) => (r.parentId ?? null) === parent).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const total = (id: string): number => (rows.find((r) => r.id === id)?.items ?? 0) + children(id).reduce((n, c) => n + total(c.id), 0);
  const pathOf = (r: FolderRow): string => {
    const parent = rows.find((x) => x.id === r.parentId);
    return parent ? `${pathOf(parent)}/${r.slug}` : r.slug;
  };

  const tree = (parent: string | null, depth: number) => (
    <ul className={cn("grid gap-1", depth > 0 && "mt-1 ml-5 border-l border-white/8 pl-3")}>
      {children(parent).map((r) => {
        const kids = children(r.id);
        const isOpen = open.has(r.id);
        return (
          <li key={r.id}>
            <div className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]">
              <button
                type="button"
                aria-label={isOpen ? `Collapse ${r.name}` : `Expand ${r.name}`}
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (isOpen) n.delete(r.id);
                    else n.add(r.id);
                    return n;
                  })
                }
                className={cn("flex size-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/10", !kids.length && "invisible")}
              >
                <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
              </button>
              <Folder className="size-4 shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold">{r.name}</span>
                <span className="block truncate text-[12px] text-white/40">
                  /{pathOf(r)} · {total(r.id)} item{total(r.id) === 1 ? "" : "s"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                <Link href={`/media/folder/${pathOf(r)}`} target="_blank" className="hidden h-9 items-center rounded-full px-3 text-[12.5px] font-bold text-white/60 hover:bg-white/10 sm:inline-flex">
                  View
                </Link>
                <Button size="sm" tone="ghost" onClick={() => setCreatingIn(r.id)} aria-label={`New folder inside ${r.name}`}>
                  <FolderPlus />
                </Button>
                <Button size="sm" tone="ghost" onClick={() => setEditing(r.id)} aria-label={`Edit ${r.name}`}>
                  <Pencil />
                </Button>
                <ConfirmButton
                  tone="ghost"
                  confirmLabel="Delete"
                  disabled={busy}
                  onConfirm={() =>
                    start(async () => {
                      setMsg(await deleteFolderAction(r.id));
                      router.refresh();
                    })
                  }
                >
                  Delete
                </ConfirmButton>
              </span>
            </div>
            {editing === r.id && (
              <div className="mt-2 mb-3 ml-9">
                <FolderForm initial={r} options={options} onDone={() => setEditing(null)} />
              </div>
            )}
            {creatingIn === r.id && (
              <div className="mt-2 mb-3 ml-9">
                <FolderForm initial={{ parentId: r.id, sort: kids.length }} options={options} onDone={() => setCreatingIn(undefined)} />
              </div>
            )}
            {isOpen && kids.length > 0 && tree(r.id, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="grid gap-4">
      <Notice tone="success">{msg.ok}</Notice>
      <Notice tone="error">{msg.error}</Notice>
      <Card
        title="Folder tree"
        description={unfiled ? `${unfiled} item${unfiled === 1 ? " isn't" : "s aren't"} in any folder.` : undefined}
        actions={
          <Button tone="primary" size="sm" onClick={() => setCreatingIn(null)}>
            <FolderPlus /> New top-level folder
          </Button>
        }
      >
        {creatingIn === null && (
          <div className="mb-4">
            <FolderForm initial={{ parentId: null, sort: children(null).length }} options={options} onDone={() => setCreatingIn(undefined)} />
          </div>
        )}
        {tree(null, 0)}
      </Card>
    </div>
  );
}
