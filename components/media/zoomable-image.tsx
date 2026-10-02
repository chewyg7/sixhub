"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/icon-button";

export interface ZoomHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  actual: () => void;
}

interface Props {
  item: MediaItem;
  className?: string;
  /** Show the floating zoom controls. */
  controls?: boolean;
  onZoomedChange?: (zoomed: boolean) => void;
}

interface View {
  s: number;
  x: number;
  y: number;
}

const MAX = 16;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Image with zoom and pan. Starts on the largest display variant and swaps
 * to the original only when the zoom level needs more pixels than the
 * variant has — the full-resolution file never loads for a casual view.
 */
export const ZoomableImage = forwardRef<ZoomHandle, Props>(function ZoomableImage({ item, className, controls = true, onZoomedChange }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const w = item.width ?? item.original.width ?? 1920;
  const h = item.height ?? item.original.height ?? 1080;
  const largest = [...item.variants].sort((a, b) => b.width - a.width)[0];
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [view, setView] = useState<View | null>(null);
  const [animate, setAnimate] = useState(false);
  const [src, setSrc] = useState(largest?.url ?? item.original.url);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; view: View; dist?: number; moved: boolean } | null>(null);

  const fitScale = useCallback((W: number, H: number) => Math.min(W / w, H / h, 1), [w, h]);
  const fitView = useCallback(
    (W: number, H: number): View => {
      const s = fitScale(W, H);
      return { s, x: (W - w * s) / 2, y: (H - h * s) / 2 };
    },
    [fitScale, w, h],
  );

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const apply = (W: number, H: number) => {
      if (W <= 0 || H <= 0) return;
      setSize({ W, H });
      setView((v) => (!v || v.s <= fitScale(W, H) + 1e-6 ? fitView(W, H) : v));
    };
    // Measure immediately so the first paint is already fitted; the observer handles later resizes.
    const r = el.getBoundingClientRect();
    apply(r.width, r.height);
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitScale, fitView]);

  const fit = size.W ? fitScale(size.W, size.H) : 1;
  const zoomed = view ? view.s > fit * 1.001 : false;
  useEffect(() => onZoomedChange?.(zoomed), [zoomed, onZoomedChange]);

  // Upgrade to the original once displayed pixels exceed the variant's resolution.
  useEffect(() => {
    if (!view || !largest || src === item.original.url) return;
    const dpr = window.devicePixelRatio || 1;
    if (view.s * w * dpr > largest.width * 1.05) {
      let cancelled = false;
      setLoadingOriginal(true);
      const img = new Image();
      img.decoding = "async";
      img.src = item.original.url;
      img
        .decode()
        .then(() => !cancelled && setSrc(item.original.url))
        .catch(() => {})
        .finally(() => !cancelled && setLoadingOriginal(false));
      return () => {
        cancelled = true;
      };
    }
  }, [view, largest, src, item.original.url, w]);

  const constrain = useCallback(
    (v: View): View => {
      const s = clamp(v.s, fit * 0.5, MAX);
      const iw = w * s;
      const ih = h * s;
      const x = iw <= size.W ? (size.W - iw) / 2 : clamp(v.x, size.W - iw, 0);
      const y = ih <= size.H ? (size.H - ih) / 2 : clamp(v.y, size.H - ih, 0);
      return { s, x, y };
    },
    [fit, w, h, size],
  );

  const zoomAt = useCallback(
    (factor: number, px: number, py: number, smooth: boolean) => {
      setAnimate(smooth);
      setView((v) => {
        if (!v) return v;
        const s = clamp(v.s * factor, fit * 0.5, MAX);
        const k = s / v.s;
        return constrain({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
      });
    },
    [constrain, fit],
  );

  const api: ZoomHandle = {
    zoomIn: () => zoomAt(1.5, size.W / 2, size.H / 2, true),
    zoomOut: () => zoomAt(1 / 1.5, size.W / 2, size.H / 2, true),
    fit: () => {
      setAnimate(true);
      setView(fitView(size.W, size.H));
    },
    actual: () => {
      setAnimate(true);
      setView((v) => (v ? constrain({ s: 1, x: size.W / 2 - ((size.W / 2 - v.x) / v.s) * 1, y: size.H / 2 - ((size.H / 2 - v.y) / v.s) * 1 }) : v));
    },
  };
  useImperativeHandle(ref, () => api);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Wheel needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      zoomAt(factor, p.x, p.y, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !view) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    gesture.current = {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
      view,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
      moved: false,
    };
    setAnimate(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    if (Math.hypot(cx - g.x, cy - g.y) > 3) g.moved = true;
    if (pts.length === 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const s = clamp(g.view.s * (d / g.dist), fit * 0.5, MAX);
      const k = s / g.view.s;
      setView(constrain({ s, x: cx - (g.x - g.view.x) * k, y: cy - (g.y - g.view.y) * k }));
    } else if (pts.length === 1) {
      setView(constrain({ s: g.view.s, x: g.view.x + (cx - g.x), y: g.view.y + (cy - g.y) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.values()];
    if (pts.length && view) gesture.current = { x: pts[0].x, y: pts[0].y, view, moved: true };
    else gesture.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = local(e);
    if (zoomed) api.fit();
    else if (view) zoomAt(Math.max(1, fit * 2.5) / view.s, p.x, p.y, true);
  };

  const pixelated = view ? view.s >= 2 : false;
  const pct = view ? Math.round(view.s * 100) : 0;

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div
        ref={box}
        className={cn("absolute inset-0 touch-none select-none", zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {view && (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic src swap to original on deep zoom
          <img
            src={src}
            alt={item.alt}
            width={w}
            height={h}
            draggable={false}
            className={cn("absolute top-0 left-0 max-w-none origin-top-left will-change-transform", item.original.hasAlpha && "checker")}
            style={{
              width: w,
              height: h,
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
              transition: animate ? "transform 220ms var(--ease-out)" : "none",
              imageRendering: pixelated ? "pixelated" : "auto",
            }}
          />
        )}
      </div>
      {controls && view && (
        <div className="glass-2 absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg p-1">
          <IconButton label="Zoom out" shortcut="−" size="icon-sm" onClick={api.zoomOut}>
            <Minus />
          </IconButton>
          <button
            type="button"
            onClick={api.actual}
            className="tabular h-8 min-w-14 rounded-md px-2 font-mono text-[12px] text-text hover:bg-surface-hover"
            aria-label={`Zoom ${pct}%. Set to 100%`}
          >
            {pct}%
          </button>
          <IconButton label="Zoom in" shortcut="+" size="icon-sm" onClick={api.zoomIn}>
            <Plus />
          </IconButton>
          <div className="mx-0.5 h-4 w-px bg-divider" />
          <IconButton label="Fit to screen" shortcut="0" size="icon-sm" onClick={api.fit} disabled={!zoomed}>
            <Maximize2 />
          </IconButton>
          {loadingOriginal && <span className="px-2 text-[11.5px] text-muted">Loading original…</span>}
        </div>
      )}
    </div>
  );
});
