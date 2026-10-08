"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Search } from "lucide-react";
import { bulkMedia, deleteMediaItems } from "@/app/chewy/(panel)/media/actions";
import type { FolderOption } from "@/lib/admin/folders";
import { cn } from "@/lib/cn";
import { Badge, Button, ConfirmButton, Empty, Input, Notice, Select } from "./ui";

export interface MediaRowLite {
  slug: string;
  title: string;
  kind: string;
  category: string;
  folderId: string;
  status: "published" | "pending";
  hidden: boolean;
  mine: boolean;
  thumb: string | null;
  color: string | null;
  dateAdded: string;
  tags: string[];
}

const PAGE = 120;

export function MediaManager({ rows, folders, categories, owner }: { rows: MediaRowLite[]; folders: FolderOption[]; categories: { slug: string; label: string }[]; owner: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("all");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [busy, start] = useTransition();
  const [target, setTarget] = useState("");
  const [tag, setTag] = useState("");

  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.label])), [folders]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!needle || r.title.toLowerCase().includes(needle) || r.slug.includes(needle) || r.tags.some((t) => t.toLowerCase().includes(needle))) &&
        (folder === "all" || (folder === "unfiled" ? !r.folderId || !folderName.has(r.folderId) : r.folderId === folder)) &&
        (category === "all" || r.category === category) &&
        (kind === "all" || r.kind === kind) &&
        (status === "all" || (status === "hidden" ? r.hidden : status === "pending" ? r.status === "pending" : status === "mine" ? r.mine : r.status === "published" && !r.hidden)),
    );
  }, [rows, q, folder, category, kind, status, folderName]);

  const shown = filtered.slice(0, limit);
  const toggle = (slug: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.slug));

  const apply = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setMessage(res);
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  return (
    <div>
      <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.9fr]">
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, slug or tag" className="pl-10" aria-label="Search media" />
        </label>
        <Select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Folder">
          <option value="all">All folders</option>
          <option value="unfiled">Unfiled</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {"  ".repeat(f.depth)}
              {f.label.split(" / ").pop()}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
          <option value="font">Fonts</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">Any status</option>
          <option value="live">Live</option>
          <option value="pending">Awaiting review</option>
          <option value="hidden">Hidden</option>
          <option value="mine">My uploads</option>
        </Select>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-white/55">
          {filtered.length.toLocaleString("en-US")} shown{selected.size > 0 && ` · ${selected.size} selected`}
        </p>
        {owner && (
          <label className="flex cursor-pointer items-center gap-2 text-[14px] text-white/70">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  shown.forEach((r) => (allShownSelected ? n.delete(r.slug) : n.add(r.slug)));
                  return n;
                })
              }
              className="size-4 accent-[#ff4fa3]"
            />
            Select all shown
          </label>
        )}
      </div>

      {owner && selected.size > 0 && (
        <div className="sticky top-3 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-[20px] border border-accent/30 bg-[#1a1020]/95 p-3 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] backdrop-blur-lg">
          <span className="px-2 text-[14px] font-bold">{selected.size} selected</span>
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 w-auto min-w-48 text-[13px]" aria-label="Move to folder">
            <option value="">Move to folder…</option>
            <option value="__root">(No folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={!target || busy} onClick={() => apply(() => bulkMedia([...selected], { type: "move", folderId: target === "__root" ? "" : target }))}>
            Move
          </Button>
          <Select defaultValue="" onChange={(e) => e.target.value && apply(() => bulkMedia([...selected], { type: "category", category: e.target.value }))} className="h-9 w-auto text-[13px]" aria-label="Set category">
            <option value="">Set category…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add tag" className="h-9 w-32 text-[13px]" aria-label="Tag to add" />
          <Button size="sm" disabled={!tag || busy} onClick={() => apply(() => bulkMedia([...selected], { type: "tag", tag }))}>
            Tag
          </Button>
          <Button size="sm" disabled={busy} onClick={() => apply(() => bulkMedia([...selected], { type: "hide" }))}>
            Hide
          </Button>
          <Button size="sm" disabled={busy} onClick={() => apply(() => bulkMedia([...selected], { type: "show" }))}>
            Show
          </Button>
          <Button size="sm" disabled={busy} onClick={() => apply(() => bulkMedia([...selected], { type: "approve" }))}>
            Approve
          </Button>
          <ConfirmButton onConfirm={() => apply(() => deleteMediaItems([...selected]))} confirmLabel={`Delete ${selected.size}`}>
            Delete
          </ConfirmButton>
          <Button size="sm" tone="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
      <div className="mt-3 grid gap-2">
        <Notice tone="success">{message.ok}</Notice>
        <Notice tone="error">{message.error}</Notice>
      </div>

      {shown.length === 0 ? (
        <div className="mt-6">
          <Empty title="Nothing matches those filters." />
        </div>
      ) : (
        <ul className={cn("mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", busy && "opacity-60")}>
          {shown.map((r) => {
            const isSel = selected.has(r.slug);
            return (
              <li key={r.slug} className={cn("group relative overflow-hidden rounded-2xl border bg-white/[0.03] transition-colors", isSel ? "border-accent" : "border-white/8 hover:border-white/20")}>
                <Link href={`/chewy/media/${r.slug}`} className="block">
                  <span className="relative block aspect-video bg-black/30" style={{ backgroundColor: r.color ?? undefined }}>
                    {r.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                      <img src={r.thumb} alt="" loading="lazy" className={cn("size-full", r.kind === "image" && r.category === "logos" ? "object-contain p-3" : "object-cover")} />
                    )}
                    <span className="absolute right-1.5 bottom-1.5 flex gap-1">
                      {r.status === "pending" && <Badge tone="warn">Pending</Badge>}
                      {r.hidden && (
                        <Badge tone="neutral">
                          <EyeOff className="mr-1 size-3" />
                          Hidden
                        </Badge>
                      )}
                    </span>
                  </span>
                  <span className="block px-3 pt-2.5 pb-3">
                    <span className="block truncate text-[13.5px] font-bold">{r.title}</span>
                    <span className="block truncate text-[12px] text-white/45">{folderName.get(r.folderId) ?? "Unfiled"}</span>
                  </span>
                </Link>
                {owner && (
                  <button
                    type="button"
                    onClick={() => toggle(r.slug)}
                    aria-pressed={isSel}
                    aria-label={isSel ? `Deselect ${r.title}` : `Select ${r.title}`}
                    className={cn(
                      "absolute top-2 left-2 flex size-7 items-center justify-center rounded-lg border transition-[opacity,background-color]",
                      isSel ? "border-accent bg-accent text-white opacity-100" : "border-white/40 bg-black/50 text-transparent opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length > limit && (
        <div className="mt-8 text-center">
          <Button onClick={() => setLimit((l) => l + PAGE)}>Show more ({(filtered.length - limit).toLocaleString("en-US")} left)</Button>
        </div>
      )}
    </div>
  );
}
