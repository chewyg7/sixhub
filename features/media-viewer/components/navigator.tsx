"use client";

import { useRef } from "react";
import type { Pane, Transform, ViewerMedia, ViewState } from "../types";
import { useViewer } from "../store";
import { visibleSourceRect, type Mat, type Size } from "../lib/geometry";

/**
 * Navigator / minimap shown when zoomed in. Shows the whole media with the
 * visible region outlined; click or drag to move the view.
 */
export function Navigator({
  pane,
  media,
  m,
  stage,
  size,
  view,
  transform,
}: {
  pane: Pane;
  media: ViewerMedia;
  m: Mat;
  stage: Size;
  size: Size;
  view: ViewState;
  transform: Transform;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const setView = useViewer((s) => s.setView);
  const dragging = useRef(false);

  const swap = transform.rotation % 180 !== 0;
  const maxW = Math.min(200, stage.w * 0.3);
  const maxH = Math.min(140, stage.h * 0.3);
  const k = Math.min(maxW / (swap ? size.h : size.w), maxH / (swap ? size.w : size.h));
  const iw = size.w * k; // inner (source-oriented) box
  const ih = size.h * k;
  const ow = swap ? ih : iw; // outer (display-oriented) box
  const oh = swap ? iw : ih;
  const vis = visibleSourceRect(stage, m, size);
  const thumb = media.thumb ?? media.poster ?? (media.kind === "image" ? media.src : undefined);

  const moveTo = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    // Undo the display rotation/flip to get source-oriented coordinates.
    let x = e.clientX - r.left - ow / 2;
    let y = e.clientY - r.top - oh / 2;
    const rad = (-transform.rotation * Math.PI) / 180;
    const c = Math.round(Math.cos(rad));
    const s = Math.round(Math.sin(rad));
    [x, y] = [x * c - y * s, x * s + y * c];
    if (transform.flipH) x = -x;
    if (transform.flipV) y = -y;
    setView(pane, { ...view, cx: (x + iw / 2) / iw, cy: (y + ih / 2) / ih, mode: "custom", animate: false });
  };

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Navigator: click or drag to move the view"
      className="glass-2 absolute right-3 bottom-3 z-20 cursor-pointer overflow-hidden rounded-md p-0"
      style={{ width: ow, height: oh }}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={(e) => dragging.current && moveTo(e)}
      onPointerUp={() => (dragging.current = false)}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{ width: iw, height: ih, transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.flipH ? -1 : 1}, ${transform.flipV ? -1 : 1})` }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- small preview
          <img src={thumb} alt="" draggable={false} className={`h-full w-full object-fill ${media.meta.hasAlpha ? "checker" : ""}`} />
        ) : (
          <div className="h-full w-full bg-surface-3" />
        )}
        <div className="absolute inset-0 bg-black/35" />
        <div
          className="absolute border-[1.5px] border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.25)]"
          style={{ left: (vis.x / size.w) * iw, top: (vis.y / size.h) * ih, width: (vis.w / size.w) * iw, height: (vis.h / size.h) * ih }}
        />
      </div>
    </div>
  );
}
