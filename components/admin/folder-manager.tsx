"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Folder, FolderPlus, GripVertical, Pencil } from "lucide-react";
import { deleteFolderAction, moveFolderAction, moveItemsAction, saveFolderAction } from "@/app/chewy/(panel)/folders/actions";
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

export interface FolderItem {
  slug: string;
  title: string;
  /** "" = not in any folder. */
  folderId: string;
  kind: string;
  thumb: string | null;
  /** Hidden or awaiting review (not on the public site). */
  hidden: boolean;
}

type Drag = { type: "folder"; id: string } | { type: "items"; slugs: string[] };
const ROOT = "__root";
const UNFILED = "__unfiled";
const PAGE = 40;

/**
 * The archive's folder tree with drag and drop. Drag a folder onto another to
 * move it inside, or onto "Top level". Expand a folder to see the items filed
 * directly in it; drag one (or a selection) onto any folder, or onto
 * "Unfiled". Moves show instantly and are saved in the background.
 */
export function FolderManager({ rows: serverRows, items: serverItems, options }: { rows: FolderRow[]; items: FolderItem[]; options: FolderOption[] }) {
  const router = useRouter();
  // Local copy for instant feedback; replaced whenever the server sends fresh data.
  const [data, setData] = useState({ rows: serverRows, items: serverItems, src: serverRows, srcItems: serverItems });
  if (data.src !== serverRows || data.srcItems !== serverItems) setData({ rows: serverRows, items: serverItems, src: serverRows, srcItems: serverItems });
  const { rows, items } = data;

  const [editing, setEditing] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState<Set<string>>(() => new Set(serverRows.filter((r) => !r.parentId).map((r) => r.id)));
  const [msg, setMsg] = useState<ActionState>({});
  const [busy, start] = useTransition();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});
  const expandTimer = useRef<number>(0);

  const children = (parent: string | null) => rows.filter((r) => (r.parentId ?? null) === parent).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const itemsIn = (folderId: string) => items.filter((i) => i.folderId === folderId);
  const total = (id: string): number => itemsIn(id).length + children(id).reduce((n, c) => n + total(c.id), 0);
  const descendants = (id: string): string[] => children(id).flatMap((c) => [c.id, ...descendants(c.id)]);
  const pathOf = (r: FolderRow): string => {
    const parent = rows.find((x) => x.id === r.parentId);
    return parent ? `${pathOf(parent)}/${r.slug}` : r.slug;
  };
  const toggleOpen = (id: string, force?: boolean) =>
    setOpen((s) => {
      const n = new Set(s);
      if (force ?? !n.has(id)) n.add(id);
      else n.delete(id);
      return n;
    });

  /** Can the current drag be dropped on `target` (a folder id, ROOT or UNFILED)? */
  const accepts = (target: string) => {
    if (!drag) return false;
    if (drag.type === "folder") {
      if (target === UNFILED) return false;
      if (target === ROOT) return !!rows.find((r) => r.id === drag.id)?.parentId;
      return target !== drag.id && !descendants(drag.id).includes(target) && rows.find((r) => r.id === drag.id)?.parentId !== target;
    }
    if (target === ROOT) return false;
    return true;
  };

  const finish = (result: ActionState) => {
    setMsg(result);
    router.refresh();
  };

  const drop = (target: string) => {
    const d = drag;
    setDrag(null);
    setOver(null);
    window.clearTimeout(expandTimer.current);
    if (!d || !accepts(target)) return;
    if (d.type === "folder") {
      const parentId = target === ROOT ? null : target;
      setData((x) => ({ ...x, rows: x.rows.map((r) => (r.id === d.id ? { ...r, parentId } : r)) }));
      if (parentId) toggleOpen(parentId, true);
      start(async () => finish(await moveFolderAction(d.id, parentId)));
    } else {
      const folderId = target === UNFILED ? "" : target;
      setData((x) => ({ ...x, items: x.items.map((i) => (d.slugs.includes(i.slug) ? { ...i, folderId } : i)) }));
      setSelected(new Set());
      if (folderId) toggleOpen(folderId, true);
      start(async () => finish(await moveItemsAction(d.slugs, folderId)));
    }
  };

  /** Props that make an element a drop target. */
  const dropTarget = (target: string, autoOpen?: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!accepts(target)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== target) {
        setOver(target);
        window.clearTimeout(expandTimer.current);
        // Hovering a closed folder opens it, so you can drop deeper.
        if (autoOpen && !open.has(autoOpen)) expandTimer.current = window.setTimeout(() => toggleOpen(autoOpen, true), 650);
      }
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === target ? null : o));
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      drop(target);
    },
  });

  const startDrag = (e: DragEvent, d: Drag, label: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", label);
    // A compact "3 items" ghost instead of the browser's screenshot of the row.
    const ghost = document.createElement("div");
    ghost.textContent = label;
    ghost.style.cssText = "position:fixed;top:-100px;left:0;padding:8px 14px;border-radius:999px;background:#ff4fa3;color:#fff;font:700 13px system-ui;white-space:nowrap";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 16, 16);
    window.setTimeout(() => ghost.remove(), 0);
    setDrag(d);
  };
  const endDrag = () => {
    setDrag(null);
    setOver(null);
    window.clearTimeout(expandTimer.current);
  };

  const toggleSelect = (slug: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  /** The items filed directly in a folder (or unfiled), as draggable chips. */
  const itemList = (folderId: string) => {
    const list = itemsIn(folderId);
    if (!list.length) return null;
    const limit = shown[folderId] ?? PAGE;
    const allSelected = list.every((i) => selected.has(i.slug));
    return (
      <div className="mt-1 mb-2 rounded-2xl border border-white/8 bg-black/20 p-2">
        <div className="mb-1.5 flex items-center justify-between px-1 text-[12px] text-white/45">
          <span>
            {list.length} item{list.length === 1 ? "" : "s"} here · drag to move
          </span>
          <button
            type="button"
            onClick={() =>
              setSelected((s) => {
                const n = new Set(s);
                list.forEach((i) => (allSelected ? n.delete(i.slug) : n.add(i.slug)));
                return n;
              })
            }
            className="font-bold text-white/55 hover:text-white"
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
          {list.slice(0, limit).map((i) => {
            const isSel = selected.has(i.slug);
            return (
              <li key={i.slug}>
                <div
                  draggable
                  onDragStart={(e) => {
                    const slugs = isSel ? [...selected] : [i.slug];
                    startDrag(e, { type: "items", slugs }, slugs.length > 1 ? `${slugs.length} items` : i.title);
                  }}
                  onDragEnd={endDrag}
                  onClick={() => toggleSelect(i.slug)}
                  title={`${i.title} (click to select, drag to move)`}
                  className={cn(
                    "flex cursor-grab items-center gap-2 rounded-xl p-1 pr-2 transition-colors active:cursor-grabbing",
                    isSel ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-white/[0.06]",
                    drag?.type === "items" && drag.slugs.includes(i.slug) && "opacity-40",
                  )}
                >
                  <span className="relative h-7 w-10 shrink-0 overflow-hidden rounded-md bg-white/10">
                    {i.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                      <img src={i.thumb} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
                    )}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", i.hidden ? "text-white/40" : "text-white/80")}>{i.title}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {list.length > limit && (
          <button type="button" onClick={() => setShown((s) => ({ ...s, [folderId]: limit + PAGE * 2 }))} className="mt-1 w-full rounded-lg py-1.5 text-[12.5px] font-bold text-white/55 hover:bg-white/[0.06] hover:text-white">
            Show {Math.min(PAGE * 2, list.length - limit)} more of {list.length - limit}
          </button>
        )}
      </div>
    );
  };

  const tree = (parent: string | null, depth: number) => (
    <ul className={cn("grid gap-1", depth > 0 && "mt-1 ml-5 border-l border-white/8 pl-3")}>
      {children(parent).map((r) => {
        const kids = children(r.id);
        const isOpen = open.has(r.id);
        const direct = itemsIn(r.id).length;
        const isOver = over === r.id;
        return (
          <li key={r.id}>
            <div
              draggable
              onDragStart={(e) => startDrag(e, { type: "folder", id: r.id }, r.name)}
              onDragEnd={endDrag}
              {...dropTarget(r.id, kids.length || direct ? r.id : undefined)}
              className={cn(
                "group flex cursor-grab items-center gap-2 rounded-xl px-2 py-1.5 transition-colors active:cursor-grabbing",
                isOver ? "bg-accent/20 ring-2 ring-accent" : "hover:bg-white/[0.04]",
                drag?.type === "folder" && drag.id === r.id && "opacity-40",
              )}
            >
              <button
                type="button"
                aria-label={isOpen ? `Collapse ${r.name}` : `Expand ${r.name}`}
                onClick={() => toggleOpen(r.id)}
                className={cn("flex size-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/10", !kids.length && !direct && "invisible")}
              >
                <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
              </button>
              <GripVertical className="size-4 shrink-0 text-white/20 group-hover:text-white/40" />
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
            {isOpen && (
              <div className="ml-5 border-l border-white/8 pl-3">
                {kids.length > 0 && tree(r.id, depth + 1)}
                {itemList(r.id)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const unfiled = itemsIn("");
  const zone = (target: string, label: string, hint: string) => (
    <div
      {...dropTarget(target)}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-[13.5px] transition-colors",
        over === target ? "border-accent bg-accent/15 text-white" : accepts(target) ? "border-white/30 text-white/70" : "border-white/10 text-white/40",
      )}
    >
      <span className="font-bold">{label}</span>
      <span className="text-white/40">{hint}</span>
    </div>
  );

  return (
    <div className="grid gap-4">
      <Notice tone="success">{msg.ok}</Notice>
      <Notice tone="error">{msg.error}</Notice>
      <Card
        title="Folder tree"
        description="Drag a folder onto another to move it inside. Open a folder to see its items, click to select several, and drag them anywhere."
        actions={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button size="sm" tone="ghost" onClick={() => setSelected(new Set())}>
                {selected.size} selected · Clear
              </Button>
            )}
            <Button tone="primary" size="sm" onClick={() => setCreatingIn(null)}>
              <FolderPlus /> New top-level folder
            </Button>
          </div>
        }
      >
        {creatingIn === null && (
          <div className="mb-4">
            <FolderForm initial={{ parentId: null, sort: children(null).length }} options={options} onDone={() => setCreatingIn(undefined)} />
          </div>
        )}
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {zone(ROOT, "Top level", "Drop a folder here to move it to the root")}
          {zone(UNFILED, `Unfiled (${unfiled.length})`, "Drop items here to take them out of folders")}
        </div>
        {tree(null, 0)}
        {unfiled.length > 0 && (
          <div className="mt-4 border-t border-white/8 pt-3">
            <button type="button" onClick={() => toggleOpen(UNFILED)} className="flex items-center gap-2 px-2 text-[14px] font-bold text-white/70 hover:text-white">
              <ChevronRight className={cn("size-4 transition-transform", open.has(UNFILED) && "rotate-90")} /> Unfiled items ({unfiled.length})
            </button>
            {open.has(UNFILED) && itemList("")}
          </div>
        )}
        {busy && <p className="mt-3 text-[12.5px] text-white/40">Saving…</p>}
      </Card>
    </div>
  );
}
