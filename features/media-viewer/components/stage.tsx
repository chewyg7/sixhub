"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import type { Pane } from "../types";
import { mediaSize, STAGE_PADDING, useConcreteView, useViewer } from "../store";
import { getElement } from "../controller";
import { apply, clampScale, cssMatrix, fitScale, invert, panBy, viewMatrix, zoomAround, type Size } from "../lib/geometry";
import { buildFilter } from "../lib/filters";
import { samplePixel } from "../lib/capture";
import { cn } from "@/lib/cn";
import { ErrorState } from "@/components/ui/states";
import { MediaElement } from "./media-element";
import { CropOverlay } from "./crop-overlay";
import { Navigator } from "./navigator";
import { AudioStage } from "./audio-stage";

interface Props {
  pane: Pane;
  /** Render pane B inside this stage (overlay / slider comparison). */
  overlay?: "overlay" | "slider" | null;
  label?: string;
}

export function Stage({ pane, overlay, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const media = useViewer((s) => s[pane]);
  const other = useViewer((s) => (overlay ? s.b : null));
  const stage = useViewer((s) => s.stage[pane]);
  const transform = useViewer((s) => s.transform);
  const adjust = useViewer((s) => s.adjust);
  const pixelated = useViewer((s) => s.pixelated);
  const minimap = useViewer((s) => s.minimap);
  const background = useViewer((s) => s.background);
  const tool = useViewer((s) => s.tool);
  const compare = useViewer((s) => s.compare);
  const error = useViewer((s) => s.errors[pane]);
  const setStage = useViewer((s) => s.setStage);
  const setView = useViewer((s) => s.setView);
  const setCursor = useViewer((s) => s.setCursor);
  const setCompare = useViewer((s) => s.setCompare);
  const view = useConcreteView(pane);
  const size = mediaSize(media);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0) setStage(pane, { w: Math.round(r.width), h: Math.round(r.height) });
    const ro = new ResizeObserver(([e]) => setStage(pane, { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pane, setStage]);

  const m = size && view ? viewMatrix(stage, size, view, transform) : null;

  // Wheel zoom around the cursor (non-passive to stop page scroll).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const s = useViewer.getState();
      const med = s[pane];
      const sz = mediaSize(med);
      if (!med || !sz || med.kind === "audio") return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const st = s.stage[pane];
      const cur =
        s.views[pane].mode === "custom"
          ? s.views[pane]
          : { scale: fitScale(st, sz, s.transform.rotation, s.views[pane].mode === "fill" ? "fill" : "fit", STAGE_PADDING), cx: 0.5, cy: 0.5, mode: "custom" as const };
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.05 : 0.0022));
      s.setView(pane, { ...zoomAround(cur, { x: e.clientX - r.left, y: e.clientY - r.top }, clampScale(cur.scale * factor), st, sz, s.transform), animate: false });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pane]);

  /* Pointer: pan (drag), pinch (two pointers), pixel read-out (hover). */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: NonNullable<typeof view>; x: number; y: number; dist?: number } | null>(null);
  const hoverRaf = useRef(0);

  const localPt = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!view || !size || media?.kind === "audio") return;
    if (tool === "crop" && pane === "a" && e.button === 0 && e.pointerType === "mouse") return;
    if (e.button !== 0 && e.button !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, localPt(e));
    const pts = [...pointers.current.values()];
    gesture.current = {
      view: { ...view, mode: "custom" },
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = localPt(e);
    if (pointers.current.has(e.pointerId) && gesture.current && size) {
      pointers.current.set(e.pointerId, p);
      const pts = [...pointers.current.values()];
      const g = gesture.current;
      const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length;
      const cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
      if (pts.length === 2 && g.dist) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const zoomed = zoomAround(g.view, { x: g.x, y: g.y }, g.view.scale * (d / g.dist), stage, size, transform);
        setView(pane, panBy(zoomed, cx - g.x, cy - g.y, transform, size));
      } else if (pts.length === 1) {
        setView(pane, panBy(g.view, cx - g.x, cy - g.y, transform, size));
      }
      return;
    }
    // Hover read-out, throttled to one update per frame.
    if (!m || !size) return;
    cancelAnimationFrame(hoverRaf.current);
    hoverRaf.current = requestAnimationFrame(() => {
      const src = apply(invert(m), p.x, p.y);
      const inside = src.x >= 0 && src.y >= 0 && src.x < size.w && src.y < size.h;
      const el = getElement(pane);
      const color = inside && media?.cors && el && !(el instanceof HTMLAudioElement) ? (samplePixel(el, src.x, src.y) ?? undefined) : undefined;
      setCursor({ x: Math.floor(src.x), y: Math.floor(src.y), inside, color });
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.values()];
    const s = useViewer.getState();
    const cur = s.views[pane];
    gesture.current = pts.length && cur.mode === "custom" ? { view: cur, x: pts[0].x, y: pts[0].y } : null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!view || !size || media?.kind === "audio" || (tool === "crop" && pane === "a")) return;
    const fit = fitScale(stage, size, transform.rotation, "fit", STAGE_PADDING);
    if (view.scale > fit * 1.05) setView(pane, { scale: 1, cx: 0.5, cy: 0.5, mode: "fit", animate: true });
    else setView(pane, { ...zoomAround(view, localPt(e), fit < 0.8 ? 1 : fit * 2.5, stage, size, transform), animate: true });
  };

  if (!media) return <div ref={box} className="relative h-full w-full" />;

  const filter = buildFilter(adjust);
  const rendering: CSSProperties["imageRendering"] = pixelated && view && view.scale >= 2 ? "pixelated" : "auto";
  const layerStyle = (s: Size): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: s.w,
    height: s.h,
    transformOrigin: "0 0",
    transform: m ? cssMatrix(m) : undefined,
    transition: view?.animate ? "transform 240ms var(--ease-out)" : "none",
    visibility: m ? "visible" : "hidden",
    willChange: "transform",
  });
  const elStyle: CSSProperties = { width: "100%", height: "100%", display: "block", maxWidth: "none", filter, imageRendering: rendering };
  const hidden = { w: 2, h: 2 };
  const showB = overlay && other && other.kind !== "audio" && size;
  const fitNow = size ? fitScale(stage, size, transform.rotation, "fit", STAGE_PADDING) : 1;

  return (
    <div
      ref={box}
      className={cn(
        "relative h-full w-full touch-none overflow-hidden select-none",
        background === "light" ? "checker-light" : background === "checker" ? "checker" : "bg-canvas",
        media.kind !== "audio" && (tool === "crop" && pane === "a" ? "" : "cursor-grab active:cursor-grabbing"),
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={onDoubleClick}
      aria-label={label ?? media.title}
      role="img"
    >
      {media.kind === "audio" ? (
        <AudioStage media={media} />
      ) : (
        <>
          <div style={layerStyle(size ?? hidden)}>
            <MediaElement pane={pane} media={media} style={elStyle} className={cn(media.meta.hasAlpha && background === "dark" && "checker")} />
          </div>

          {showB && overlay === "overlay" && (
            <div style={{ ...layerStyle(size), opacity: compare.opacity, mixBlendMode: compare.blend === "difference" ? "difference" : "normal" }}>
              <MediaElement pane="b" media={other} style={elStyle} />
            </div>
          )}

          {showB && overlay === "slider" && (
            <>
              <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${compare.split * 100}%)` }}>
                <div style={layerStyle(size)}>
                  <MediaElement pane="b" media={other} style={elStyle} />
                </div>
              </div>
              <SliderHandle split={compare.split} onChange={(split) => setCompare({ split })} width={stage.w} />
            </>
          )}
        </>
      )}

      {overlay && other && (
        <>
          <PaneLabel side="left">A · {media.title}</PaneLabel>
          <PaneLabel side="right">B · {other.title}</PaneLabel>
        </>
      )}
      {!overlay && label && <PaneLabel side="left">{label}</PaneLabel>}

      {pane === "a" && tool === "crop" && m && size && media.kind !== "audio" && <CropOverlay m={m} stage={stage} media={size} />}

      {minimap && m && size && view && media.kind !== "audio" && view.scale > fitNow * 1.02 && (
        <Navigator pane={pane} media={media} m={m} stage={stage} size={size} view={view} transform={transform} />
      )}

      {!size && !error && media.kind !== "audio" && (
        <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
          <span className="flex items-center gap-2 rounded-md bg-black/50 px-3 py-2 text-[12.5px] text-white/80">
            <Loader2 className="size-4 animate-spin" /> Loading {media.kind}…
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas/90 p-6">
          <ErrorState
            compact
            title="Couldn't open this media"
            description={error}
            onRetry={() => {
              const s = useViewer.getState();
              const cur = s[pane];
              if (cur) s.load(pane, { ...cur, id: Math.random().toString(36).slice(2), cors: cur.origin === "url" ? true : cur.cors });
            }}
            className="max-w-md bg-surface"
          />
        </div>
      )}
    </div>
  );
}

function PaneLabel({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-3 z-10 max-w-[45%] truncate rounded-[5px] bg-black/60 px-2 py-1 text-[11.5px] font-medium text-white/90 backdrop-blur-sm",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {children}
    </div>
  );
}

/** Draggable divider for slider comparison. */
function SliderHandle({ split, onChange, width }: { split: number; onChange: (v: number) => void; width: number }) {
  const dragging = useRef(false);
  const set = (e: React.PointerEvent) => {
    const parent = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, (e.clientX - parent.left) / parent.width)));
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Comparison divider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(split * 100)}
      className="group/split absolute inset-y-0 z-10 w-8 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
      style={{ left: split * width }}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => dragging.current && set(e)}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        if (e.key === "ArrowLeft") onChange(Math.max(0, split - step));
        else if (e.key === "ArrowRight") onChange(Math.min(1, split + step));
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]" />
      <div className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform group-focus-visible/split:ring-2 group-focus-visible/split:ring-[var(--focus)] group-active/split:scale-95">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path d="M6 4 2 8l4 4M10 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
