"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, EyeOff, X } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { Navbar } from "@/components/layout/navbar";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useViewer } from "../store";
import { player, registerRoot } from "../controller";
import { SHORTCUTS } from "../shortcuts";
import { useViewerActions, loadMedia } from "../use-actions";
import { fromArchive, fromUrl } from "../lib/sources";
import { parseUrlState, serializeUrlState } from "../lib/url-state";
import { ViewerFilterDefs } from "../lib/filters";
import { setPendingSeek } from "./media-element";
import { Stage } from "./stage";
import { Toolbar } from "./toolbar";
import { Transport } from "./transport";
import { StatusBar } from "./status-bar";
import { BrowserPanel } from "./browser-panel";
import { Inspector } from "./inspector";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { EmptyViewer } from "./empty-viewer";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return Boolean(el?.closest?.("input, textarea, select, [contenteditable='true']"));
};

export function ViewerApp({ items }: { items: MediaItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const filePane = useRef<"a" | "b">("a");
  const params = useSearchParams();
  const actions = useViewerActions();
  const a = useViewer((s) => s.a);
  const b = useViewer((s) => s.b);
  const compare = useViewer((s) => s.compare);
  const panels = useViewer((s) => s.panels);
  const adjust = useViewer((s) => s.adjust);
  const tool = useViewer((s) => s.tool);
  const hasCrop = useViewer((s) => Boolean(s.crop.rect));
  const setPanels = useViewer((s) => s.setPanels);
  const [fullscreen, setFullscreen] = useState(false);
  const [drag, setDrag] = useState<"a" | "b" | "over" | null>(null);
  const [sheet, setSheet] = useState<"browser" | "tools" | null>(null);
  const [idle, setIdle] = useState(false);

  const openFile = useCallback((pane: "a" | "b" = "a") => {
    filePane.current = pane;
    fileInput.current?.click();
  }, []);

  /* Development-only handle for debugging and automated checks. */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (window as unknown as { __ghViewer?: typeof useViewer }).__ghViewer = useViewer;
  }, []);

  /* Root element for fullscreen */
  useEffect(() => {
    registerRoot(root.current);
    const onFs = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      registerRoot(null);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  /* Restore state from the URL once. */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const u = parseUrlState(new URLSearchParams(params.toString()));
    const s = useViewer.getState();
    const bySlug = new Map(items.map((m) => [m.slug, m]));
    if (u.t !== undefined) setPendingSeek(u.t);
    const aItem = u.m ? bySlug.get(u.m) : undefined;
    if (aItem) loadMedia("a", fromArchive(aItem));
    else if (u.src) {
      const m = fromUrl(u.src);
      if (!("error" in m)) loadMedia("a", m);
    }
    if (u.r) useViewer.setState((st) => ({ transform: { ...st.transform, rotation: u.r! } }));
    if (u.z && (aItem || u.src)) s.setView("a", { scale: u.z, cx: u.x ?? 0.5, cy: u.y ?? 0.5, mode: "custom" });
    const bItem = u.b ? bySlug.get(u.b) : undefined;
    if (bItem) loadMedia("b", fromArchive(bItem));
    else if (u.bsrc) {
      const m = fromUrl(u.bsrc);
      if (!("error" in m)) loadMedia("b", m);
    }
    if (u.cm || u.compare || bItem || u.bsrc) s.setCompare({ enabled: true, ...(u.cm ? { mode: u.cm } : {}) });
  }, [items, params]);

  /* Keep the URL in sync (debounced; time only while paused). */
  useEffect(() => {
    let t = 0;
    const unsub = useViewer.subscribe((s, prev) => {
      if (
        s.a === prev.a &&
        s.b === prev.b &&
        s.views === prev.views &&
        s.transform === prev.transform &&
        s.compare === prev.compare &&
        s.playback.playing === prev.playback.playing &&
        s.playback.frame === prev.playback.frame
      )
        return;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const st = useViewer.getState();
        const sp = serializeUrlState(st, !st.playback.playing);
        const next = `/viewer${sp.size ? `?${sp}` : ""}`;
        if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
      }, 450);
    });
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = e.target as HTMLElement;
      // Let focused sliders/radio groups use their own arrow keys.
      if (/^Arrow/.test(e.key) && target.closest?.('[role="slider"], [role="radiogroup"], [role="menu"], [role="listbox"]')) return;
      const s = useViewer.getState();
      if (e.key === "Escape") {
        if (s.crop.rect && s.tool === "crop") s.setCrop({ rect: null });
        else if (s.tool === "crop") s.setTool("pan");
        else if (s.panels.focus) s.setPanels({ focus: false });
        else return;
        e.preventDefault();
        return;
      }
      const sc = SHORTCUTS.find((x) => x.match(e));
      if (!sc) return;
      // Media-dependent shortcuts need something loaded.
      if (!s.a && !["Panels"].includes(sc.group) && sc.label !== "Open a file") return;
      e.preventDefault();
      sc.run({ actions, openFile: () => openFile("a") });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, openFile]);

  /* Paste an image or media file from the clipboard. */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        actions.openFiles(files);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && /^https?:\/\/\S+\.(jpe?g|png|webp|avif|gif|mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?\S*)?$/i.test(text)) {
        e.preventDefault();
        actions.openUrl(text);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [actions]);

  /* Distraction-free mode: fade chrome after inactivity. */
  useEffect(() => {
    if (!panels.focus) return;
    let t = window.setTimeout(() => setIdle(true), 2200);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 2200);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      setIdle(false);
    };
  }, [panels.focus]);

  /* Pause on unmount (navigating away). */
  useEffect(() => () => player.pause(), []);

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!drag) setDrag("over");
  };
  const onDrop = (e: React.DragEvent, pane: "a" | "b") => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(null);
    if (e.dataTransfer.files.length) actions.openFiles(e.dataTransfer.files, pane);
  };

  const side = compare.enabled && b && compare.mode === "side";
  const overlay = compare.enabled && b && compare.mode !== "side" ? compare.mode : null;
  const showPanels = !panels.focus;

  return (
    <div
      ref={root}
      className="flex h-[100dvh] flex-col overflow-hidden bg-bg"
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(null);
      }}
      onDrop={(e) => onDrop(e, "a")}
    >
      <ViewerFilterDefs adjust={adjust} />
      {showPanels && !fullscreen && <Navbar variant="app" />}

      <div className="flex min-h-0 flex-1">
        {showPanels && panels.browser && (
          <>
            <aside aria-label="Media browser" className="hidden shrink-0 flex-col border-r border-divider bg-surface lg:flex" style={{ width: panels.browserW }}>
              <BrowserPanel items={items} onOpenFile={openFile} />
            </aside>
            <ResizeHandle side="left" value={panels.browserW} min={220} max={440} onChange={(w) => setPanels({ browserW: w })} />
          </>
        )}

        <main id="main" className="relative flex min-w-0 flex-1 flex-col">
          <div className={cn("transition-opacity duration-300", panels.focus && idle && "pointer-events-none opacity-0")}>
            <Toolbar onOpenFile={openFile} onOpenSheet={setSheet} fullscreen={fullscreen} />
          </div>

          <div className="relative min-h-0 flex-1">
            {a ? (
              <div className={cn("absolute inset-0 flex", side && "flex-col md:flex-row")}>
                <div className="relative min-h-0 min-w-0 flex-1">
                  <Stage pane="a" overlay={overlay} label={side ? `A · ${a.title}` : undefined} />
                </div>
                {side && (
                  <>
                    <div className="h-px w-full shrink-0 bg-border-strong md:h-full md:w-px" />
                    <div className="relative min-h-0 min-w-0 flex-1">
                      <Stage pane="b" label={`B · ${b!.title}`} />
                    </div>
                  </>
                )}
                {compare.enabled && !b && (
                  <div className="glass-2 absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-3 text-[12.5px]">
                    Choose a second asset (B) to compare
                    <Button size="xs" onClick={() => openFile("b")}>
                      Open file
                    </Button>
                    <Button size="xs" className="lg:hidden" onClick={() => setSheet("browser")}>
                      Browse
                    </Button>
                    <button
                      type="button"
                      aria-label="Close compare"
                      onClick={() => useViewer.getState().setCompare({ enabled: false })}
                      className="rounded p-1 text-muted hover:text-text"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyViewer items={items} onOpenFile={() => openFile("a")} />
            )}

            {/* Mobile crop bar */}
            {tool === "crop" && a && (
              <div className="glass-2 absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg p-1 lg:hidden">
                <Button size="sm" variant="ghost" disabled={!hasCrop} onClick={() => actions.exportCrop("download")}>
                  <Download /> Save
                </Button>
                <Button size="sm" variant="ghost" disabled={!hasCrop} onClick={() => actions.exportCrop("copy")}>
                  <Copy /> Copy
                </Button>
                <Button size="sm" variant="primary" onClick={() => useViewer.getState().setTool("pan")}>
                  <Check /> Done
                </Button>
              </div>
            )}

            {panels.focus && (
              <button
                type="button"
                onClick={() => setPanels({ focus: false })}
                className={cn(
                  "glass-2 absolute top-3 right-3 z-30 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-opacity duration-300",
                  idle && "pointer-events-none opacity-0",
                )}
              >
                <EyeOff className="size-3.5" /> Exit distraction-free <span className="font-mono text-faint">Z</span>
              </button>
            )}

            {drag && (
              <div className="absolute inset-0 z-40 flex animate-fade-in gap-3 bg-bg/80 p-4 backdrop-blur-sm" onDragLeave={(e) => e.stopPropagation()}>
                {(a ? (["a", "b"] as const) : (["a"] as const)).map((pane) => (
                  <div
                    key={pane}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (drag !== pane) setDrag(pane);
                    }}
                    onDrop={(e) => onDrop(e, pane)}
                    className={cn(
                      "flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors",
                      drag === pane ? "border-text bg-surface" : "border-border-strong",
                    )}
                  >
                    <p className="text-[16px] font-semibold">{pane === "a" ? "Open" : "Compare"}</p>
                    <p className="mt-1 text-[13px] text-muted">{pane === "a" ? "Drop to open in the viewer" : "Drop to compare with the current media"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!panels.focus && <StatusBar />}
          <div className={cn("transition-opacity duration-300", panels.focus && idle && "pointer-events-none opacity-0")}>
            <Transport />
          </div>
        </main>

        {showPanels && panels.inspector && a && (
          <>
            <ResizeHandle side="right" value={panels.inspectorW} min={260} max={460} onChange={(w) => setPanels({ inspectorW: w })} />
            <aside aria-label="Inspector" className="hidden shrink-0 overflow-y-auto border-l border-divider bg-surface lg:block" style={{ width: panels.inspectorW }}>
              <Inspector onOpenFile={openFile} />
            </aside>
          </>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) actions.openFiles(e.target.files, filePane.current);
          e.target.value = "";
        }}
      />
      <ShortcutsDialog />

      <Sheet open={sheet === "browser"} onClose={() => setSheet(null)} title="Browse media">
        <div className="h-[70dvh]">
          <BrowserPanel items={items} onOpenFile={(p) => (setSheet(null), openFile(p))} onPicked={() => setSheet(null)} />
        </div>
      </Sheet>
      <Sheet open={sheet === "tools"} onClose={() => setSheet(null)} title="Tools">
        <Inspector onOpenFile={(p) => (setSheet(null), openFile(p))} />
      </Sheet>
    </div>
  );
}

/** Drag / keyboard resizable panel edge. */
function ResizeHandle({ side, value, min, max, onChange }: { side: "left" | "right"; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize media browser" : "Resize inspector"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      className="group/rh relative z-10 -mx-1 hidden w-2 shrink-0 cursor-col-resize touch-none outline-none lg:block"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, w: value };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        onChange(Math.min(max, Math.max(min, start.current.w + (side === "left" ? dx : -dx))));
      }}
      onPointerUp={() => (start.current = null)}
      onKeyDown={(e) => {
        const d = e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        onChange(Math.min(max, Math.max(min, value + (side === "left" ? d : -d))));
      }}
    >
      <div className="mx-auto h-full w-px bg-transparent transition-colors duration-150 group-hover/rh:bg-accent group-focus-visible/rh:bg-accent" />
    </div>
  );
}
