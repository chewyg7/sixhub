"use client";

import {
  Columns2,
  Crop,
  Expand,
  Hand,
  Keyboard,
  Link2,
  Maximize,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  RotateCw,
  SlidersHorizontal,
  FolderOpen,
  MoreHorizontal,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatResolution } from "@/lib/format";
import { Badge } from "@/components/ui/controls";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { buttonClass } from "@/components/ui/button";
import { useConcreteView, useViewer } from "../store";
import { player } from "../controller";
import { useViewerActions } from "../use-actions";

function ZoomControl() {
  const view = useConcreteView("a");
  const zoomBy = useViewer((s) => s.zoomBy);
  const zoomTo = useViewer((s) => s.zoomTo);
  const fit = useViewer((s) => s.fit);
  const pct = view ? view.scale * 100 : 100;
  const label = pct >= 1000 ? `${Math.round(pct)}%` : `${+pct.toFixed(pct < 10 ? 1 : 0)}%`;
  return (
    <div className="flex items-center">
      <IconButton label="Zoom out" shortcut="−" size="icon-sm" onClick={() => zoomBy(0.8)}>
        <Minus />
      </IconButton>
      <Popover
        label="Zoom presets"
        placement="below"
        trigger={(p) => (
          <Tooltip content="Zoom presets">
            <button
              {...p}
              type="button"
              aria-label={`Zoom ${label}`}
              className="tabular h-8 min-w-[62px] rounded-md px-1.5 font-mono text-[12px] text-text transition-colors hover:bg-surface-hover"
            >
              {label}
            </button>
          </Tooltip>
        )}
      >
        {(close) => (
          <div className="grid w-44 gap-0.5">
            {(
              [
                ["Fit to screen", "0", () => fit("fit")],
                ["Fill screen", "", () => fit("fill")],
                ["50%", "", () => zoomTo(0.5)],
                ["100% · actual pixels", "1", () => zoomTo(1)],
                ["200%", "2", () => zoomTo(2)],
                ["400%", "4", () => zoomTo(4)],
                ["800%", "", () => zoomTo(8)],
                ["1600%", "", () => zoomTo(16)],
              ] as const
            ).map(([l, key, fn]) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  fn();
                  close();
                }}
                className="flex h-8 items-center justify-between rounded-md px-2.5 text-left text-[12.5px] hover:bg-surface-hover"
              >
                {l}
                {key && <span className="font-mono text-[11px] text-faint">{key}</span>}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <IconButton label="Zoom in" shortcut="+" size="icon-sm" onClick={() => zoomBy(1.25)}>
        <Plus />
      </IconButton>
    </div>
  );
}

interface Props {
  onOpenFile: (pane: "a" | "b") => void;
  onOpenSheet: (sheet: "browser" | "tools") => void;
  fullscreen: boolean;
}

export function Toolbar({ onOpenFile, onOpenSheet, fullscreen }: Props) {
  const media = useViewer((s) => s.a);
  const tool = useViewer((s) => s.tool);
  const panels = useViewer((s) => s.panels);
  const compare = useViewer((s) => s.compare.enabled);
  const setTool = useViewer((s) => s.setTool);
  const setPanels = useViewer((s) => s.setPanels);
  const setCompare = useViewer((s) => s.setCompare);
  const rotate = useViewer((s) => s.rotate);
  const set = useViewer((s) => s.set);
  const actions = useViewerActions();
  const visual = media && media.kind !== "audio";

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-divider bg-surface px-1.5 sm:px-2" role="toolbar" aria-label="Viewer tools">
      <IconButton
        label={panels.browser ? "Hide media browser" : "Show media browser"}
        shortcut="B"
        size="icon-sm"
        pressed={panels.browser}
        onClick={() => setPanels({ browser: !panels.browser })}
        className="hidden lg:inline-flex"
      >
        <PanelLeft />
      </IconButton>
      <IconButton label="Browse media" size="icon-sm" onClick={() => onOpenSheet("browser")} className="lg:hidden">
        <PanelLeft />
      </IconButton>

      <div className="mx-1 flex min-w-0 flex-1 items-center gap-2 lg:flex-initial">
        {media ? (
          <>
            <h1 className="min-w-0 truncate text-[13px] font-semibold lg:max-w-[260px]">{media.title}</h1>
            <span className="tabular hidden shrink-0 font-mono text-[11.5px] text-faint xl:inline">
              {media.meta.width ? formatResolution(media.meta.width, media.meta.height) : media.kind}
            </span>
            {media.item?.verification === "sample" && (
              <Badge tone="sample" className="hidden shrink-0 sm:inline-flex">
                Sample
              </Badge>
            )}
            {media.origin === "local" && (
              <Badge tone="outline" className="hidden shrink-0 sm:inline-flex">
                Local
              </Badge>
            )}
            {media.origin === "capture" && (
              <Badge tone="accent" className="hidden shrink-0 sm:inline-flex">
                Capture
              </Badge>
            )}
          </>
        ) : (
          <h1 className="text-[13px] font-semibold">Media Viewer</h1>
        )}
      </div>

      {visual && (
        <div className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          <div className="flex rounded-md bg-surface-2 p-0.5" role="radiogroup" aria-label="Tool">
            <IconButton label="Move" shortcut="V" size="icon-sm" role="radio" aria-checked={tool === "pan"} pressed={tool === "pan"} onClick={() => setTool("pan")}>
              <Hand />
            </IconButton>
            <IconButton
              label="Crop"
              shortcut="C"
              size="icon-sm"
              role="radio"
              aria-checked={tool === "crop"}
              pressed={tool === "crop"}
              onClick={() => setTool(tool === "crop" ? "pan" : "crop")}
            >
              <Crop />
            </IconButton>
          </div>
          <div className="mx-1.5 h-5 w-px bg-divider" />
          <ZoomControl />
          <div className="mx-1.5 h-5 w-px bg-divider" />
          <IconButton label="Rotate right" shortcut="R" size="icon-sm" onClick={() => rotate(1)}>
            <RotateCw />
          </IconButton>
          <IconButton label={compare ? "Exit compare" : "Compare"} shortcut="X" size="icon-sm" pressed={compare} onClick={() => setCompare({ enabled: !compare })}>
            <Columns2 />
          </IconButton>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Open file" shortcut="Ctrl O" size="icon-sm" onClick={() => onOpenFile("a")} className="hidden sm:inline-flex">
          <FolderOpen />
        </IconButton>
        {media && (
          <IconButton label="Copy link to this view" size="icon-sm" onClick={actions.copyLink} className="hidden sm:inline-flex">
            <Link2 />
          </IconButton>
        )}
        <IconButton label="Keyboard shortcuts" shortcut="?" size="icon-sm" onClick={() => set({ shortcutsOpen: true })} className="hidden lg:inline-flex">
          <Keyboard />
        </IconButton>
        <IconButton
          label={panels.focus ? "Exit distraction-free mode" : "Distraction-free mode"}
          shortcut="Z"
          size="icon-sm"
          pressed={panels.focus}
          onClick={() => setPanels({ focus: !panels.focus })}
          className="hidden lg:inline-flex"
        >
          {panels.focus ? <EyeOff /> : <Expand />}
        </IconButton>
        <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} shortcut="F" size="icon-sm" onClick={player.toggleFullscreen} className="hidden sm:inline-flex">
          <Maximize />
        </IconButton>
        <IconButton
          label={panels.inspector ? "Hide inspector" : "Show inspector"}
          shortcut="I"
          size="icon-sm"
          pressed={panels.inspector}
          onClick={() => setPanels({ inspector: !panels.inspector })}
          className="hidden lg:inline-flex"
        >
          <PanelRight />
        </IconButton>
        {media && (
          <IconButton label="Tools" size="icon-sm" onClick={() => onOpenSheet("tools")} className="lg:hidden">
            <SlidersHorizontal />
          </IconButton>
        )}
        <Menu
          align="end"
          items={[
            { label: "Open file…", onSelect: () => onOpenFile("a") },
            ...(media ? [{ label: "Copy link to this view", onSelect: actions.copyLink }] : []),
            ...(visual
              ? [
                  { label: tool === "crop" ? "Exit crop" : "Crop", onSelect: () => setTool(tool === "crop" ? "pan" : "crop") },
                  { label: compare ? "Exit compare" : "Compare", onSelect: () => setCompare({ enabled: !compare }) },
                ]
              : []),
            { label: "Fullscreen", onSelect: player.toggleFullscreen },
          ]}
          trigger={(p) => (
            <button {...p} type="button" aria-label="More" className={cn(buttonClass({ variant: "ghost", size: "icon-sm" }), "sm:hidden")}>
              <MoreHorizontal />
            </button>
          )}
        />
      </div>
    </div>
  );
}
