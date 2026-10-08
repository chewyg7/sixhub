"use client";

import { useState } from "react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { ArchiveView } from "./archive-view";

/**
 * A folder's items, with a switch between what's filed directly here and
 * everything in the folders below it.
 */
export function FolderContents({ direct, deep, labels }: { direct: MediaItem[]; deep: MediaItem[]; labels: Parameters<typeof ArchiveView>[0]["labels"] }) {
  const hasSub = deep.length > direct.length;
  const [all, setAll] = useState(direct.length === 0);
  const items = all && hasSub ? deep : direct;
  return (
    <>
      {hasSub && (
        <div role="radiogroup" aria-label="Show" className="mb-6 inline-flex rounded-full bg-white/[0.05] p-1">
          {[
            { v: false, label: `In this folder (${direct.length})`, disabled: direct.length === 0 },
            { v: true, label: `Including subfolders (${deep.length})`, disabled: false },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={all === o.v}
              disabled={o.disabled}
              onClick={() => setAll(o.v)}
              className={cn("h-9 rounded-full px-4 text-[13.5px] font-bold transition-colors disabled:opacity-40", all === o.v ? "bg-white text-[#140c18]" : "text-white/65 hover:text-white")}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <ArchiveView key={all ? "deep" : "direct"} items={items} labels={labels} />
    </>
  );
}
