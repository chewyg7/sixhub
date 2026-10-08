"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, DownloadCloud, Loader2, RefreshCw } from "lucide-react";
import { scanAction, startImportAction } from "@/app/chewy/(panel)/grabber/actions";
import type { JobState, ScanGallery } from "@/lib/grabber/gtavice";
import type { FolderOption } from "@/lib/admin/folders";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, Empty, Notice, Select } from "./ui";
import { formatTime } from "./format";

interface Run {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  status: string;
  startedBy: string | null;
  report: { total?: number; added?: number; skipped?: number; failed?: number; log?: string[] };
}

export function GrabberPanel({ folders, categories, runs, running }: { folders: FolderOption[]; categories: { slug: string; label: string }[]; runs: Run[]; running: string | null }) {
  const router = useRouter();
  const [galleries, setGalleries] = useState<ScanGallery[] | null>(null);
  const [error, setError] = useState<string>();
  const [scanning, startScan] = useTransition();
  const [starting, startImport] = useTransition();
  const [picked, setPicked] = useState<Record<string, Set<string>>>({});
  const [dest, setDest] = useState<Record<string, { folderId: string; category: string }>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [polling, setPolling] = useState(!!running);

  const scan = () =>
    startScan(async () => {
      setError(undefined);
      const res = await scanAction();
      if (res.error) return setError(res.error);
      const g = res.galleries ?? [];
      setGalleries(g);
      setPicked(Object.fromEntries(g.map((x) => [x.slug, new Set(x.newItems.map((i) => i.path))])));
      setDest(Object.fromEntries(g.map((x) => [x.slug, { folderId: x.known ? "auto" : x.folderId, category: x.category }])));
    });

  // Poll progress while an import runs.
  useEffect(() => {
    if (!polling) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch("/chewy/api/grabber", { headers: { "x-chewy": "1" }, cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (stop || !r) return;
      setJob(r.job);
      if (r.job?.status !== "running") {
        setPolling(false);
        router.refresh();
      }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [polling, router]);

  const totalPicked = useMemo(() => Object.values(picked).reduce((n, s) => n + s.size, 0), [picked]);
  const withNew = galleries?.filter((g) => g.newItems.length) ?? [];

  const begin = () =>
    startImport(async () => {
      if (!galleries) return;
      const requests = galleries
        .filter((g) => picked[g.slug]?.size)
        .map((g) => ({
          gallery: g.slug,
          galleryTitle: g.title,
          galleryUrl: g.url,
          folderId: dest[g.slug]?.folderId ?? "auto",
          category: dest[g.slug]?.category ?? g.category,
          items: g.newItems.filter((i) => picked[g.slug].has(i.path)),
        }));
      const res = await startImportAction(requests);
      if (res.error) return setError(res.error);
      setGalleries(null);
      setPolling(true);
    });

  return (
    <div className="grid gap-6">
      <Notice tone="error">{error}</Notice>

      {job && (
        <Card title={job.status === "running" ? "Importing…" : job.status === "done" ? "Import finished" : "Import stopped"}>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[image:var(--sunset)] transition-[width] duration-500" style={{ width: `${job.total ? (job.done / job.total) * 100 : 100}%` }} />
          </div>
          <p className="mt-3 text-[14px] text-white/70">
            {job.done} of {job.total} · {job.added} added · {job.skipped} already had · {job.failed} failed
          </p>
          {job.log.length > 0 && (
            <ul className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-black/30 p-3 font-mono text-[12.5px] text-white/70">
              {job.log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!galleries ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <DownloadCloud className="size-10 text-accent-text" />
            <p className="max-w-md text-[15px] text-white/65">Scanning reads gtavice.net’s gallery pages (it takes a few seconds). Nothing is imported until you choose.</p>
            <Button tone="primary" onClick={scan} disabled={scanning || polling}>
              {scanning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {scanning ? "Checking every gallery…" : "Check GTAVice for new media"}
            </Button>
          </div>
        </Card>
      ) : withNew.length === 0 ? (
        <Empty title="You're up to date.">
          All {galleries.reduce((n, g) => n + g.total, 0).toLocaleString("en-US")} images across {galleries.length} galleries are already in the archive.{" "}
          <button type="button" onClick={scan} className="font-bold text-accent-text">
            Check again
          </button>
        </Empty>
      ) : (
        <>
          <Notice>
            Found {withNew.reduce((n, g) => n + g.newItems.length, 0)} new images in {withNew.length} galleries. Everything else on GTAVice is already here.
          </Notice>
          <ul className="grid gap-4">
            {withNew.map((g) => {
              const sel = picked[g.slug] ?? new Set<string>();
              const d = dest[g.slug] ?? { folderId: "auto", category: g.category };
              return (
                <li key={g.slug} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setOpen(open === g.slug ? null : g.slug)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className={cn("size-5 shrink-0 transition-transform", open === g.slug && "rotate-180")} />
                      <span className="truncate text-[16px] font-bold">{g.title}</span>
                      {!g.known && <Badge tone="accent">New gallery</Badge>}
                      <span className="text-[13px] text-white/50">
                        {sel.size}/{g.newItems.length} selected
                      </span>
                    </button>
                    <Select
                      value={d.folderId}
                      onChange={(e) => setDest((x) => ({ ...x, [g.slug]: { ...d, folderId: e.target.value } }))}
                      className="h-9 w-auto max-w-72 text-[13px]"
                      aria-label={`Destination for ${g.title}`}
                    >
                      {g.known && <option value="auto">Automatic (by gallery and subject)</option>}
                      {!g.known && <option value={g.folderId}>New folder “{g.title}”</option>}
                      <option value="">(No folder)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                    <Select value={d.category} onChange={(e) => setDest((x) => ({ ...x, [g.slug]: { ...d, category: e.target.value } }))} className="h-9 w-auto text-[13px]" aria-label={`Category for ${g.title}`}>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {open === g.slug && (
                    <>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" tone="ghost" onClick={() => setPicked((p) => ({ ...p, [g.slug]: new Set(g.newItems.map((i) => i.path)) }))}>
                          Select all
                        </Button>
                        <Button size="sm" tone="ghost" onClick={() => setPicked((p) => ({ ...p, [g.slug]: new Set() }))}>
                          Select none
                        </Button>
                      </div>
                      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                        {g.newItems.map((i) => {
                          const on = sel.has(i.path);
                          return (
                            <li key={i.path}>
                              <button
                                type="button"
                                title={i.title}
                                aria-pressed={on}
                                onClick={() =>
                                  setPicked((p) => {
                                    const n = new Set(p[g.slug]);
                                    if (on) n.delete(i.path);
                                    else n.add(i.path);
                                    return { ...p, [g.slug]: n };
                                  })
                                }
                                className={cn("relative block aspect-video w-full overflow-hidden rounded-lg border-2 transition-opacity", on ? "border-accent" : "border-transparent opacity-40")}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- remote preview thumbnail */}
                                <img src={i.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                {on && <CheckCircle2 className="absolute top-1 right-1 size-4 text-white drop-shadow" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="primary" onClick={begin} disabled={!totalPicked || starting}>
              {starting ? <Loader2 className="animate-spin" /> : <DownloadCloud />} Import {totalPicked} image{totalPicked === 1 ? "" : "s"}
            </Button>
            <Button tone="ghost" onClick={() => setGalleries(null)}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {runs.length > 0 && (
        <Card title="Recent runs">
          <ul className="divide-y divide-white/8">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                <span>
                  {formatTime(r.startedAt)} · @{r.startedBy}
                </span>
                <span className="text-white/60">
                  <Badge tone={r.status === "done" ? "good" : r.status === "running" ? "accent" : "bad"}>{r.status}</Badge> {r.report.added ?? 0} added · {r.report.failed ?? 0} failed
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
