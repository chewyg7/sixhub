"use client";

import { useState } from "react";
import { FileUp, Film, Image as ImageIcon, Plus } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { formatDuration } from "@/lib/format";
import { smallestVariant } from "@/lib/media/variants";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useIsMac } from "@/lib/hooks/use-client";
import { useViewerActions } from "../use-actions";

/** Start screen: drop zone, file/URL open and quick picks from the archive. */
export function EmptyViewer({ items, onOpenFile, onBrowse }: { items: MediaItem[]; onOpenFile: () => void; onBrowse?: () => void }) {
  const actions = useViewerActions();
  const [url, setUrl] = useState("");
  const isMac = useIsMac();
  const videos = items.filter((m) => m.kind === "video").slice(0, 3);
  const images = items
    .filter((m) => m.kind === "image" && !m.original.hasAlpha)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
    .slice(0, 3);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 pt-[calc(env(safe-area-inset-top)+96px)] pb-10 lg:py-10">
        {/* Phones: pick from the archive first; dragging files and shortcuts are desktop things. */}
        <div className="text-center lg:hidden">
          <h2 className="display-xl text-[44px] leading-[0.95]">Look closer</h2>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-muted">Step through trailers frame by frame, zoom into screenshots, and save stills in full quality.</p>
          <div className="mt-6 grid gap-2">
            <button
              type="button"
              onClick={onBrowse}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[image:var(--sunset)] text-[16px] font-bold text-white shadow-[0_12px_30px_-12px_rgb(255_79_163/0.9)] active:scale-[0.98]"
            >
              <Plus className="size-5" strokeWidth={2.4} /> Add from the archive
            </button>
            <button type="button" onClick={onOpenFile} className="h-12 rounded-2xl bg-white/[0.07] text-[15px] font-bold text-white/85 active:scale-[0.98]">
              Open a file from this phone
            </button>
          </div>
        </div>
        <div className="hidden rounded-2xl border-2 border-dashed border-border-strong px-6 py-10 text-center lg:block">
          <FileUp className="mx-auto size-7 text-muted" aria-hidden />
          <h2 className="display mt-4 text-[30px]">Drop media to analyze</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted">
            Images, videos and audio open locally in your browser — nothing is uploaded. Drop two files to compare them.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" onClick={onOpenFile}>
              Open file
            </Button>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (actions.openUrl(url)) setUrl("");
              }}
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="or paste a media URL"
                aria-label="Media URL"
                className="h-9 w-56 rounded-md border border-border bg-surface px-3 text-[13px] outline-none focus:border-border-strong"
              />
              <Button type="submit" disabled={!url.trim()}>
                Load
              </Button>
            </form>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-faint">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>V</Kbd> pastes an image · <Kbd>?</Kbd> shows all shortcuts
          </p>
        </div>

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 sm:grid-cols-2">
          {[
            { title: "Videos", icon: Film, list: videos },
            { title: "High-resolution images", icon: ImageIcon, list: images },
          ].map((g) => (
            <section key={g.title}>
              <h3 className="eyebrow mb-3 flex items-center gap-1.5">
                <g.icon className="size-3.5" /> {g.title}
              </h3>
              <ul className="space-y-1">
                {g.list.map((m) => (
                  <li key={m.slug}>
                    <button
                      type="button"
                      onClick={() => actions.openArchive(m)}
                      className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-surface"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- small variant */}
                      <img src={smallestVariant(m, 200)?.url} alt="" className="aspect-[16/10] w-20 shrink-0 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium">{m.title}</p>
                        <p className="tabular font-mono text-[11.5px] text-faint">
                          {m.kind === "video" ? `${formatDuration(m.video?.duration)} · ${m.video?.fps} fps` : `${m.width} × ${m.height}`}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
