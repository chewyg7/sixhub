"use client";

import { aspectRatioLabel } from "@/lib/format";
import { useConcreteView, useViewer } from "../store";

/** Cursor pixel coordinates, colour under the cursor, dimensions and zoom. */
export function StatusBar() {
  const media = useViewer((s) => s.a);
  const cursor = useViewer((s) => s.cursor);
  const pixelated = useViewer((s) => s.pixelated);
  const tool = useViewer((s) => s.tool);
  const view = useConcreteView("a");
  if (!media || media.kind === "audio" || media.kind === "font") return null;
  const { width: w, height: h } = media.meta;
  const zoom = view ? view.scale * 100 : 0;
  return (
    <div className="tabular hidden h-7 shrink-0 items-center gap-4 border-t border-divider bg-surface px-3 font-mono text-[11px] text-muted md:flex" aria-live="off">
      <span className="flex min-w-[150px] items-center gap-2">
        {cursor?.inside ? (
          <>
            <span>
              X <span className="text-text">{cursor.x}</span>
            </span>
            <span>
              Y <span className="text-text">{cursor.y}</span>
            </span>
          </>
        ) : (
          <span className="text-faint">Hover to inspect pixels</span>
        )}
      </span>
      {cursor?.inside && cursor.color && (
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border border-border-strong" style={{ background: cursor.color === "transparent" ? undefined : cursor.color }} aria-hidden />
          <span className="text-text uppercase">{cursor.color}</span>
        </span>
      )}
      <span className="flex-1" />
      {tool === "crop" && <span className="text-accent-text">Crop tool</span>}
      {w && h && (
        <span>
          {w} × {h} · {aspectRatioLabel(w, h)}
        </span>
      )}
      <span>
        <span className="text-text">{zoom >= 100 ? Math.round(zoom) : zoom.toFixed(1)}%</span>
        {pixelated && zoom >= 200 && <span className="text-faint"> · pixels</span>}
      </span>
    </div>
  );
}
