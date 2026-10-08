"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, X, XCircle } from "lucide-react";
import type { FolderOption } from "@/lib/admin/folders";
import { cn } from "@/lib/cn";
import { titleFromFilename } from "@/lib/slug";
import { Button, Card, Field, Input, Select, Toggle } from "./ui";
import { ChipPicker } from "./media-edit-form";

interface Job {
  id: string;
  file: File;
  title: string;
  progress: number;
  state: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
  slug?: string;
  status?: string;
}

const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.avif,.mp4,.mov,.webm,.mp3,.m4a,.wav,.ogg,.flac,.ttf,.otf,.woff,.woff2";

/** Sends one file as the raw request body so the server can stream it to disk; XHR gives upload progress. */
function send(file: File, meta: object, onProgress: (p: number) => void, onUploaded: () => void): Promise<{ slug?: string; status?: string; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/chewy/api/upload");
    xhr.setRequestHeader("x-chewy", "1");
    xhr.setRequestHeader("x-upload-meta", encodeURIComponent(JSON.stringify(meta)));
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.upload.onload = onUploaded;
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ error: `Upload failed (${xhr.status}).` });
      }
    };
    xhr.onerror = () => resolve({ error: "Network error. Check your connection and try again." });
    xhr.send(file);
  });
}

export function Uploader({
  folders,
  categories,
  sources,
  characters,
  locations,
  owner,
}: {
  folders: FolderOption[];
  categories: { slug: string; label: string }[];
  sources: { slug: string; label: string }[];
  characters: { slug: string; name: string }[];
  locations: { slug: string; name: string }[];
  owner: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);

  const add = (files: FileList | File[]) =>
    setJobs((j) => [...j, ...[...files].map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, title: titleFromFilename(file.name), progress: 0, state: "queued" as const }))]);
  const patch = (id: string, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const start = async () => {
    if (!form.current) return;
    const f = new FormData(form.current);
    const base = {
      purpose: "media",
      folderId: String(f.get("folderId") ?? ""),
      category: String(f.get("category") ?? ""),
      sourceSlug: String(f.get("sourceSlug") ?? ""),
      datePublished: String(f.get("datePublished") ?? "") || undefined,
      tags: String(f.get("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      characters: f.getAll("characters").map(String),
      locations: f.getAll("locations").map(String),
      credit: String(f.get("credit") ?? "") || undefined,
      verification: String(f.get("verification") ?? "official"),
      downloadable: f.get("downloadable") === "on",
      hidden: f.get("hidden") === "on",
    };
    setRunning(true);
    for (const job of jobs.filter((j) => j.state === "queued" || j.state === "error")) {
      patch(job.id, { state: "uploading", progress: 0, error: undefined });
      const res = await send(
        job.file,
        { ...base, filename: job.file.name, title: job.title },
        (p) => patch(job.id, { progress: p }),
        () => patch(job.id, { state: "processing", progress: 1 }),
      );
      if (res.error) patch(job.id, { state: "error", error: res.error });
      else patch(job.id, { state: "done", slug: res.slug, status: res.status });
    }
    setRunning(false);
    router.refresh();
  };

  const queued = jobs.filter((j) => j.state === "queued" || j.state === "error").length;

  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card title="Files">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) add(e.dataTransfer.files);
          }}
          className={cn("grid place-items-center rounded-[20px] border-2 border-dashed px-6 py-12 text-center transition-colors", drag ? "border-accent bg-accent/10" : "border-white/15")}
        >
          <FileUp className="size-9 text-accent-text" />
          <p className="mt-3 text-[16px] font-bold">Drop files here</p>
          <p className="mt-1 text-[13.5px] text-white/50">Images up to 80 MB, videos up to 6 GB, audio up to 600 MB, fonts up to 25 MB</p>
          <Button className="mt-5" onClick={() => input.current?.click()}>
            Choose files
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {jobs.length > 0 && (
          <ul className="mt-5 grid gap-2">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-center gap-3">
                  {j.state === "done" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-[#7ee8ae]" />
                  ) : j.state === "error" ? (
                    <XCircle className="size-5 shrink-0 text-[#ff8a9a]" />
                  ) : j.state === "queued" ? (
                    <FileUp className="size-5 shrink-0 text-white/40" />
                  ) : (
                    <Loader2 className="size-5 shrink-0 animate-spin text-accent-text" />
                  )}
                  <Input value={j.title} onChange={(e) => patch(j.id, { title: e.target.value })} disabled={j.state !== "queued" && j.state !== "error"} aria-label={`Title for ${j.file.name}`} className="h-9 text-[13.5px]" />
                  <span className="hidden shrink-0 text-[12px] text-white/45 sm:block">{(j.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  {(j.state === "queued" || j.state === "error") && (
                    <button type="button" onClick={() => setJobs((js) => js.filter((x) => x.id !== j.id))} aria-label={`Remove ${j.file.name}`} className="shrink-0 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {(j.state === "uploading" || j.state === "processing") && (
                  <div className="mt-2.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[image:var(--sunset)] transition-[width] duration-200" style={{ width: `${Math.round(j.progress * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[12px] text-white/50">{j.state === "processing" ? "Processing: making previews…" : `Uploading ${Math.round(j.progress * 100)}%`}</p>
                  </div>
                )}
                {j.error && <p className="mt-2 text-[12.5px] text-[#ff8a9a]">{j.error}</p>}
                {j.state === "done" && j.slug && (
                  <p className="mt-2 text-[12.5px] text-white/60">
                    {j.status === "pending" ? "Sent for review. " : "Live. "}
                    <Link href={`/chewy/media/${j.slug}`} className="font-bold text-accent-text">
                      Edit details
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid content-start gap-6">
        <Card title="Applies to every file">
          <div className="grid gap-4">
            <Field label="Folder">
              <Select name="folderId" defaultValue="">
                <option value="">(No folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select name="category" defaultValue={categories[0]?.slug}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Select name="sourceSlug" defaultValue="rockstar-website">
                {sources.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Published" hint="Leave empty for today.">
              <Input name="datePublished" type="date" />
            </Field>
            <Field label="Tags" hint="Comma separated.">
              <Input name="tags" maxLength={1500} />
            </Field>
            <Field label="Trust level">
              <Select name="verification" defaultValue="official">
                <option value="official">Official (Rockstar)</option>
                <option value="reported">Reported (press)</option>
                <option value="community">Community made</option>
              </Select>
            </Field>
            <Field label="Credit">
              <Input name="credit" placeholder="Rockstar Games" maxLength={120} />
            </Field>
            <div>
              <p className="mb-2 text-[13.5px] font-bold text-white/80">Characters</p>
              <ChipPicker name="characters" options={characters} initial={[]} />
            </div>
            <div>
              <p className="mb-2 text-[13.5px] font-bold text-white/80">Locations</p>
              <ChipPicker name="locations" options={locations} initial={[]} />
            </div>
            <Toggle name="downloadable" defaultChecked label="Allow downloads" />
            {owner && <Toggle name="hidden" label="Upload as hidden" hint="Keep them off the site until you un-hide them." />}
          </div>
        </Card>
        <Button tone="primary" disabled={!queued || running} onClick={start} className="w-full">
          {running && <Loader2 className="animate-spin" />}
          {running ? "Uploading…" : queued ? `Upload ${queued} file${queued === 1 ? "" : "s"}` : "Add files to upload"}
        </Button>
      </div>
    </form>
  );
}
