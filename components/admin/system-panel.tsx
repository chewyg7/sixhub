"use client";

import Link from "next/link";
import { useState } from "react";
import { DatabaseBackup, Download, FileJson, HardDrive, RefreshCw, SearchCheck } from "lucide-react";
import { backupNow, checkFiles, refreshSite, removeBackup } from "@/app/chewy/(panel)/system/actions";
import { formatBytes } from "@/lib/format";
import { Badge, Button, Card, ConfirmButton, Empty, Notice, formatTime, useAction } from "./ui";

export interface SystemData {
  database: number;
  uploads: { bytes: number; files: number };
  backups: { bytes: number; files: number };
  disk: { free: number; total: number } | null;
  media: { total: number; kinds: Record<string, number> };
  node: string;
  uptime: number;
  memory: number;
  dataDir: string;
  backupList: { name: string; bytes: number; at: number }[];
}

const uptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export function SystemPanel({ data }: { data: SystemData }) {
  const [pending, result, act] = useAction();
  const [missing, setMissing] = useState<{ slug: string; title: string; missing: string[] }[] | null>(null);
  const diskUsed = data.disk ? 1 - data.disk.free / data.disk.total : 0;

  return (
    <div className="grid gap-6">
      <Notice tone="success">{result.ok}</Notice>
      <Notice tone="error">{result.error}</Notice>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Database", value: formatBytes(data.database) },
          { label: `Uploads (${data.uploads.files.toLocaleString("en-US")} files)`, value: formatBytes(data.uploads.bytes) },
          { label: "Media items", value: data.media.total.toLocaleString("en-US") },
          { label: "Server up for", value: uptime(data.uptime) },
        ].map((s) => (
          <div key={s.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <span className="display-xl block text-[34px] leading-none">{s.value}</span>
            <span className="mt-2 block text-[13.5px] text-white/55">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Quick fixes">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14.5px] font-bold">Refresh the whole site</p>
                <p className="text-[13px] text-white/50">If something looks stale, this rebuilds every page with the latest content.</p>
              </div>
              <Button disabled={pending} onClick={() => act(refreshSite)}>
                <RefreshCw className="size-4" /> Refresh
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14.5px] font-bold">Check uploaded files</p>
                <p className="text-[13px] text-white/50">Finds media whose files are missing from the server’s disk.</p>
              </div>
              <Button
                disabled={pending}
                onClick={() =>
                  act(async () => {
                    const r = await checkFiles();
                    setMissing(r.missing ?? null);
                    return r;
                  })
                }
              >
                <SearchCheck className="size-4" /> Run check
              </Button>
            </div>
            {missing && missing.length > 0 && (
              <ul className="grid gap-1.5 rounded-2xl bg-black/25 p-3 text-[13px]">
                {missing.slice(0, 50).map((m) => (
                  <li key={m.slug} className="flex justify-between gap-3">
                    <Link href={`/chewy/media/${m.slug}`} className="truncate font-bold hover:text-accent-text">
                      {m.title}
                    </Link>
                    <span className="shrink-0 text-white/45">{m.missing.length} missing</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14.5px] font-bold">Export content</p>
                <p className="text-[13px] text-white/50">All media records, folders, pages and settings as JSON. No accounts or passwords.</p>
              </div>
              <a href="/chewy/api/export" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold hover:bg-white/15">
                <FileJson className="size-4" /> Download JSON
              </a>
            </div>
          </div>
        </Card>

        <Card title="Server">
          <dl className="grid gap-2.5 text-[14px]">
            {data.disk && (
              <div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-2 text-white/55">
                    <HardDrive className="size-4" /> Disk
                  </dt>
                  <dd>
                    {formatBytes(data.disk.free)} free of {formatBytes(data.disk.total)}
                  </dd>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={diskUsed > 0.9 ? "h-full bg-[#ff4d6d]" : "h-full bg-[image:var(--sunset)]"} style={{ width: `${Math.round(diskUsed * 100)}%` }} />
                </div>
              </div>
            )}
            {[
              ["Media by type", Object.entries(data.media.kinds).map(([k, n]) => `${n} ${k}`).join(" · ")],
              ["Backups", `${data.backups.files} (${formatBytes(data.backups.bytes)})`],
              ["Node.js", data.node],
              ["Memory in use", formatBytes(data.memory)],
              ["Data folder", data.dataDir],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-white/55">{k}</dt>
                <dd className="truncate text-right font-mono text-[13px]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card
        title="Database backups"
        description="A snapshot of every account, setting and media record (uploaded files aren’t included). The newest 20 are kept. Downloads contain account data, so keep them private."
        actions={
          <Button tone="primary" disabled={pending} onClick={() => act(backupNow)}>
            <DatabaseBackup className="size-4" /> Back up now
          </Button>
        }
      >
        {data.backupList.length ? (
          <ul className="divide-y divide-white/8">
            {data.backupList.map((b, i) => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[13.5px]">{b.name}</span>
                {i === 0 && <Badge tone="good">Latest</Badge>}
                <span className="text-[12.5px] text-white/45">
                  {formatBytes(b.bytes)} · {formatTime(b.at)}
                </span>
                <a href={`/chewy/api/backup?name=${encodeURIComponent(b.name)}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-bold hover:bg-white/15">
                  <Download className="size-3.5" /> Download
                </a>
                <ConfirmButton confirmLabel="Delete" onConfirm={() => act(() => removeBackup(b.name))} disabled={pending}>
                  Delete
                </ConfirmButton>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No backups yet">Make one before big changes.</Empty>
        )}
        <p className="mt-4 text-[12.5px] leading-relaxed text-white/40">
          To restore one: stop the site, copy the file over <code className="text-white/65">{data.dataDir}/gtasixhub.db</code> (and delete the -wal/-shm files next to it), then start it again.
        </p>
      </Card>
    </div>
  );
}
