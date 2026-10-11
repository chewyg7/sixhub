"use client";

import { useState } from "react";
import { ImageOff, Music2, Play } from "lucide-react";
import type { RepoItem } from "@/lib/repos";

/** One repo item in the grid. The picture comes straight from the repo's link. */
export function RepoTile({ item, onOpen }: { item: RepoItem; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const still = item.thumbnail ?? (item.kind === "image" ? item.url : undefined);
  return (
    <button type="button" onClick={onOpen} className="group block w-full text-left">
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[18px] bg-white/[0.05] ring-1 ring-white/8 transition-[box-shadow] duration-300 group-hover:ring-white/25">
        {still && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party image, loaded straight from the repo's link
          <img
            src={still}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]"
          />
        ) : item.kind === "video" && !broken ? (
          <video src={`${item.url}#t=0.5`} preload="metadata" muted playsInline onError={() => setBroken(true)} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-white/35">{item.kind === "audio" ? <Music2 className="size-9" /> : <ImageOff className="size-8" />}</span>
        )}
        {item.kind !== "image" && (
          <span className="absolute bottom-2.5 left-2.5 flex size-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-md">
            {item.kind === "video" ? <Play className="size-3.5 fill-current" /> : <Music2 className="size-3.5" />}
          </span>
        )}
      </span>
      <span className="mt-2 block truncate text-[14px] font-bold text-white/90">{item.title}</span>
      {item.folder && <span className="block truncate text-[12.5px] text-white/45">{item.folder}</span>}
    </button>
  );
}
