"use client";

import Link from "next/link";
import { ChevronLeft, MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { Menu } from "@/components/ui/menu";
import { formatResolution } from "@/lib/format";
import { useViewer } from "../store";
import { player } from "../controller";
import { useViewerActions } from "../use-actions";

const pill = "flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90";

/**
 * Phone chrome for the Media Viewer: one floating glass pill over the media.
 * Back · what's open · + (add from the archive) · tools · more.
 */
export function MobileViewerBar({ onBrowse, onTools, onOpenFile }: { onBrowse: () => void; onTools: () => void; onOpenFile: () => void }) {
  const media = useViewer((s) => s.a);
  const tool = useViewer((s) => s.tool);
  const compare = useViewer((s) => s.compare.enabled);
  const setTool = useViewer((s) => s.setTool);
  const setCompare = useViewer((s) => s.setCompare);
  const actions = useViewerActions();
  const visual = media && media.kind !== "audio";
  const sub = media
    ? [media.kind === "video" ? "Video" : media.kind === "audio" ? "Audio" : "Image", media.meta.width ? formatResolution(media.meta.width, media.meta.height) : null].filter(Boolean).join(" · ")
    : "Pick something to view";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+10px)] lg:hidden">
      <LiquidGlass elevated radius={30} bezel={18} thickness={36} tint="rgb(14 10 20 / 0.62)" className="pointer-events-auto flex items-center gap-1 p-1">
        <Link href="/" aria-label="Back to GTA 6 Hub" className={`${pill} text-white/80`}>
          <ChevronLeft className="size-[22px]" />
        </Link>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-[14px] font-bold text-white">{media?.title ?? "Media Viewer"}</p>
          <p className="truncate text-[11.5px] text-white/50">{sub}</p>
        </div>
        <button type="button" onClick={onBrowse} aria-label="Add from the archive" className={`${pill} bg-[image:var(--sunset)] shadow-[0_6px_18px_-6px_rgb(255_79_163/0.9)]`}>
          <Plus className="size-[22px]" strokeWidth={2.4} />
        </button>
        {media && (
          <button type="button" onClick={onTools} aria-label="Tools" className={`${pill} text-white/80`}>
            <SlidersHorizontal className="size-[20px]" />
          </button>
        )}
        <Menu
          align="end"
          items={[
            { label: "Open a file from this phone", onSelect: onOpenFile },
            ...(media ? [{ label: "Copy link to this view", onSelect: actions.copyLink }] : []),
            ...(visual
              ? [
                  { label: tool === "crop" ? "Exit crop" : "Crop", onSelect: () => setTool(tool === "crop" ? "pan" : "crop") },
                  { label: compare ? "Exit compare" : "Compare with another", onSelect: () => setCompare({ enabled: !compare }) },
                ]
              : []),
            ...(media ? [{ label: "Fullscreen", onSelect: player.toggleFullscreen }] : []),
          ]}
          trigger={(p) => (
            <button {...p} type="button" aria-label="More" className={`${pill} text-white/80`}>
              <MoreHorizontal className="size-[20px]" />
            </button>
          )}
        />
      </LiquidGlass>
    </div>
  );
}
