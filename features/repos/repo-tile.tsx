"use client";

import Link from "next/link";
import { useState } from "react";
import { AudioLines, ImageOff, Play, ScanSearch } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { buttonClass } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { viewerHrefFor } from "@/components/media/media-links";

/** One repo item in the grid. Pictures come straight from the repo's links. */
export function RepoTile({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const still = item.variants[0]?.url ?? item.poster?.url;
  return (
    <article className="group">
      <button type="button" onClick={onOpen} aria-label={`Preview ${item.title}`} className="block w-full text-left">
        <span className="media-zoom relative block aspect-[16/10] overflow-hidden rounded-lg bg-surface-2">
          {still && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- third-party image, loaded straight from the repo's link
            <img src={still} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full object-cover" />
          ) : item.kind === "video" && !broken ? (
            <video src={`${item.original.url}#t=0.5`} preload="metadata" muted playsInline onError={() => setBroken(true)} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-white/35">{item.kind === "audio" ? <AudioLines className="size-9" /> : <ImageOff className="size-8" />}</span>
          )}
          {item.kind !== "image" && (
            <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-[5px] bg-black/60 px-1.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {item.kind === "video" ? <Play className="size-3 fill-current" /> : <AudioLines className="size-3" />}
              {item.kind === "video" ? "Video" : "Audio"}
            </span>
          )}
        </span>
      </button>
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="line-clamp-1 text-[14px] leading-snug font-semibold text-text hover:underline hover:decoration-border-strong hover:underline-offset-4">{item.title}</span>
          {item.description && <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{item.description}</span>}
        </button>
        <Tooltip content="Open in Media Viewer">
          <Link
            href={viewerHrefFor(item)}
            aria-label={`Open ${item.title} in Media Viewer`}
            className={buttonClass({ variant: "ghost", size: "icon-sm", className: "-mt-1 -mr-1.5 shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100" })}
          >
            <ScanSearch />
          </Link>
        </Tooltip>
      </div>
    </article>
  );
}
