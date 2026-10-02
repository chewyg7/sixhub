"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Storyboard } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDuration, formatTimecode } from "@/lib/format";

interface ScrubberProps {
  duration: number;
  current: number;
  buffered?: [number, number][];
  onSeek: (t: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  storyboard?: Storyboard;
  fps?: number;
  label?: string;
  /** Arrow-key step and shift+arrow step, in seconds. */
  step?: number;
  bigStep?: number;
  accent?: boolean;
  /** Precise timecodes (viewer) vs. m:ss (players). */
  precise?: boolean;
  /** Custom track background (e.g. waveform). */
  background?: ReactNode;
  className?: string;
  height?: "thin" | "tall";
  /** Loop range (seconds) drawn on the track. */
  range?: [number, number] | null;
}

export function Scrubber({
  duration,
  current,
  buffered,
  onSeek,
  onScrubStart,
  onScrubEnd,
  storyboard,
  fps,
  label = "Seek",
  step = 5,
  bigStep = 10,
  accent,
  precise,
  background,
  className,
  height = "thin",
  range,
}: ScrubberProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; t: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const valid = duration > 0 && Number.isFinite(duration);
  const pct = valid ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

  const timeAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - r.left), r.width);
    return { x, w: r.width, t: valid ? (x / r.width) * duration : 0 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!valid || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onScrubStart?.();
    const h = timeAt(e.clientX);
    setHover(h);
    onSeek(h.t);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!valid) return;
    const h = timeAt(e.clientX);
    setHover(h);
    if (dragging) onSeek(h.t);
  };
  const end = () => {
    if (!dragging) return;
    setDragging(false);
    onScrubEnd?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!valid) return;
    let t: number | null = null;
    const s = e.shiftKey ? bigStep : step;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") t = current + s;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") t = current - s;
    else if (e.key === "PageUp") t = current + duration / 10;
    else if (e.key === "PageDown") t = current - duration / 10;
    else if (e.key === "Home") t = 0;
    else if (e.key === "End") t = duration;
    if (t !== null) {
      e.preventDefault();
      e.stopPropagation();
      onSeek(Math.min(duration, Math.max(0, t)));
    }
  };

  const fmt = (t: number) => (precise ? formatTimecode(t, duration >= 3600) : formatDuration(t));
  const frameText = fps ? `, frame ${Math.floor(current * fps + 1e-6)}` : "";

  let tile: React.CSSProperties | null = null;
  if (storyboard && hover) {
    const i = Math.min(storyboard.count - 1, Math.floor(hover.t / storyboard.interval));
    const w = 160;
    const k = w / storyboard.tileWidth;
    tile = {
      width: w,
      height: storyboard.tileHeight * k,
      backgroundImage: `url(${storyboard.url})`,
      backgroundSize: `${storyboard.columns * storyboard.tileWidth * k}px ${storyboard.rows * storyboard.tileHeight * k}px`,
      backgroundPosition: `${-(i % storyboard.columns) * storyboard.tileWidth * k}px ${-Math.floor(i / storyboard.columns) * storyboard.tileHeight * k}px`,
    };
  }
  const trackH = height === "tall" ? "h-9" : "h-4";

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valid ? Math.round(duration * 1000) / 1000 : 0}
      aria-valuenow={Math.round(current * 1000) / 1000}
      aria-valuetext={`${fmt(current)} of ${fmt(duration)}${frameText}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => !dragging && setHover(null)}
      onKeyDown={onKeyDown}
      className={cn("group/scrub relative flex cursor-pointer touch-none items-center outline-none select-none", trackH, !valid && "cursor-default opacity-50", className)}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-white/15 transition-[height] duration-150",
          background ? "h-full rounded-md bg-transparent" : dragging ? "h-[6px]" : "h-[3px] group-hover/scrub:h-[5px] group-focus-visible/scrub:h-[5px]",
        )}
      >
        {background}
        {!background &&
          buffered?.map(([a, b], i) => (
            <div key={i} className="absolute inset-y-0 bg-white/20" style={{ left: `${(a / duration) * 100}%`, width: `${((b - a) / duration) * 100}%` }} />
          ))}
        {range && valid && (
          <div className="absolute inset-y-0 bg-accent/25" style={{ left: `${(range[0] / duration) * 100}%`, width: `${((range[1] - range[0]) / duration) * 100}%` }} />
        )}
        {!background && <div className={cn("absolute inset-y-0 left-0", accent ? "bg-accent" : "bg-white")} style={{ width: `${pct}%` }} />}
        {background && <div className="absolute inset-y-0 left-0 bg-white/10" style={{ width: `${pct}%` }} />}
      </div>
      {/* playhead */}
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[opacity,transform] duration-150",
          background
            ? "h-full w-[2px] rounded-full bg-accent"
            : cn(
                "size-3 rounded-full shadow-[0_0_0_2px_rgb(0_0_0/0.35)]",
                accent ? "bg-accent" : "bg-white",
                dragging ? "scale-110 opacity-100" : "scale-75 opacity-0 group-hover/scrub:scale-100 group-hover/scrub:opacity-100 group-focus-visible/scrub:opacity-100",
              ),
        )}
        style={{ left: `${pct}%` }}
      />
      {hover && valid && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 flex -translate-x-1/2 flex-col items-center gap-1"
          style={{ left: Math.min(Math.max(hover.x, tile ? 80 : 30), hover.w - (tile ? 80 : 30)) }}
        >
          {tile && <div className="overflow-hidden rounded-md border border-white/15 bg-black shadow-lg" style={tile} />}
          <span className="tabular rounded-[5px] bg-black/80 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {fmt(hover.t)}
            {fps ? <span className="text-white/60"> · F{Math.floor(hover.t * fps + 1e-6)}</span> : null}
          </span>
        </div>
      )}
    </div>
  );
}
