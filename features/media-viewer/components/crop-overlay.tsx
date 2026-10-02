"use client";

import { useRef, useState } from "react";
import type { Rect } from "../types";
import { aspectValue, useViewer } from "../store";
import { apply, invert, roundRect, sourceRectToScreen, type Mat, type Size } from "../lib/geometry";

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface Drag {
  kind: "new" | "move" | "resize";
  handle?: Handle;
  start: { x: number; y: number };
  rect: ScreenRect;
}

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSOR: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

/**
 * Crop selection drawn in screen space (so aspect ratios apply to what the
 * user sees, even when rotated) and stored in source pixels.
 */
export function CropOverlay({ m, media }: { m: Mat; stage: Size; media: Size }) {
  const ref = useRef<HTMLDivElement>(null);
  const crop = useViewer((s) => s.crop);
  const setCrop = useViewer((s) => s.setCrop);
  const zoomToRect = useViewer((s) => s.zoomToRect);
  const [drag, setDrag] = useState<Drag | null>(null);
  const ratio = aspectValue(crop);
  const bounds = sourceRectToScreen({ x: 0, y: 0, w: media.w, h: media.h }, m);
  const screen = crop.rect ? sourceRectToScreen(crop.rect, m) : null;

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(e.clientX - r.left, bounds.left), bounds.left + bounds.width), y: Math.min(Math.max(e.clientY - r.top, bounds.top), bounds.top + bounds.height) };
  };

  const toSource = (s: ScreenRect): Rect => {
    const inv = invert(m);
    const p1 = apply(inv, s.left, s.top);
    const p2 = apply(inv, s.left + s.width, s.top + s.height);
    const x = Math.max(0, Math.min(p1.x, p2.x));
    const y = Math.max(0, Math.min(p1.y, p2.y));
    return { x, y, w: Math.min(media.w, Math.max(p1.x, p2.x)) - x, h: Math.min(media.h, Math.max(p1.y, p2.y)) - y };
  };

  /** Rect from a fixed anchor to a point, honouring the ratio and staying inside the media. */
  const fromAnchor = (ax: number, ay: number, px: number, py: number): ScreenRect => {
    let dx = px - ax;
    let dy = py - ay;
    if (ratio) {
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      if (w / Math.max(h, 1e-6) > ratio) dx = Math.sign(dx || 1) * h * ratio;
      else dy = Math.sign(dy || 1) * (w / ratio);
    }
    return { left: Math.min(ax, ax + dx), top: Math.min(ay, ay + dy), width: Math.abs(dx), height: Math.abs(dy) };
  };

  const onPointerDown = (e: React.PointerEvent, kind: Drag["kind"], handle?: Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    setDrag({ kind, handle, start: p, rect: screen ?? { left: p.x, top: p.y, width: 0, height: 0 } });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = local(e);
    const r = drag.rect;
    let next: ScreenRect;
    if (drag.kind === "new") next = fromAnchor(drag.start.x, drag.start.y, p.x, p.y);
    else if (drag.kind === "move") {
      const left = Math.min(Math.max(r.left + (p.x - drag.start.x), bounds.left), bounds.left + bounds.width - r.width);
      const top = Math.min(Math.max(r.top + (p.y - drag.start.y), bounds.top), bounds.top + bounds.height - r.height);
      next = { ...r, left, top };
    } else {
      const h = drag.handle!;
      const right = r.left + r.width;
      const bottom = r.top + r.height;
      if (h.length === 2) {
        const ax = h.includes("w") ? right : r.left;
        const ay = h.includes("n") ? bottom : r.top;
        next = fromAnchor(ax, ay, p.x, p.y);
      } else if (h === "n" || h === "s") {
        const top = h === "n" ? Math.min(p.y, bottom - 1) : r.top;
        const bot = h === "s" ? Math.max(p.y, r.top + 1) : bottom;
        next = { left: r.left, top, width: r.width, height: bot - top };
      } else {
        const left = h === "w" ? Math.min(p.x, right - 1) : r.left;
        const rgt = h === "e" ? Math.max(p.x, r.left + 1) : right;
        next = { left, top: r.top, width: rgt - left, height: r.height };
      }
    }
    if (next.width >= 2 && next.height >= 2) setCrop({ rect: toSource(next) });
  };

  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    const r = useViewer.getState().crop.rect;
    if (r) setCrop({ rect: r.w < 2 || r.h < 2 ? null : roundRect(r) });
  };

  const px = crop.rect ? roundRect(crop.rect) : null;

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-10 touch-none"
      style={{ cursor: drag?.kind === "move" ? "grabbing" : "crosshair" }}
      onPointerDown={(e) => onPointerDown(e, "new")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Crop area. Drag to select."
    >
      {!screen && (
        <div className="glass-2 pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md px-3 py-1.5 text-[12.5px] text-text">
          Drag over the image to select an area{ratio ? ` (${crop.aspect === "custom" ? crop.custom.join(":") : crop.aspect})` : ""}
        </div>
      )}
      {screen && (
        <>
          {/* Dim outside the selection */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "rgb(0 0 0 / 0.55)",
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${screen.left}px ${screen.top}px, ${screen.left}px ${screen.top + screen.height}px, ${screen.left + screen.width}px ${screen.top + screen.height}px, ${screen.left + screen.width}px ${screen.top}px, ${screen.left}px ${screen.top}px)`,
            }}
          />
          <div
            className="absolute border border-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
            style={{ left: screen.left, top: screen.top, width: screen.width, height: screen.height, cursor: drag ? undefined : "move" }}
            onPointerDown={(e) => onPointerDown(e, "move")}
            onDoubleClick={() => crop.rect && zoomToRect(crop.rect)}
          >
            {/* Rule of thirds */}
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white" />
            </div>
            {HANDLES.filter((h) => !ratio || h.length === 2).map((h) => (
              <div
                key={h}
                onPointerDown={(e) => onPointerDown(e, "resize", h)}
                className="absolute size-3 rounded-[2px] border border-black/50 bg-white"
                style={{
                  cursor: CURSOR[h],
                  left: h.includes("w") ? -6 : h.includes("e") ? "calc(100% - 6px)" : "calc(50% - 6px)",
                  top: h.includes("n") ? -6 : h.includes("s") ? "calc(100% - 6px)" : "calc(50% - 6px)",
                }}
              />
            ))}
          </div>
          {px && (
            <div
              className="tabular pointer-events-none absolute rounded-[4px] bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white"
              style={{ left: screen.left, top: screen.top > 26 ? screen.top - 24 : screen.top + screen.height + 6 }}
            >
              {px.w} × {px.h} px
            </div>
          )}
        </>
      )}
    </div>
  );
}
