"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, Info, Maximize, Minimize, ScanSearch, X } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { useCategory } from "@/components/site-data";
import { cn } from "@/lib/cn";
import { aspectRatioLabel, formatBytes, formatDate, formatDuration, formatFps, formatResolution } from "@/lib/format";
import { lockScroll, useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { library } from "@/features/library/store";
import { IconButton } from "@/components/ui/icon-button";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { ZoomableImage, type ZoomHandle } from "./zoomable-image";
import { VideoPlayer } from "./player/video-player";
import { AudioPlayer } from "./player/audio-player";
import { FavoriteButton } from "./favorite-button";
import { MediaThumb } from "./media-thumb";
import { viewerHref } from "./media-links";

interface Props {
  items: MediaItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

export function Lightbox({ items, index, onIndexChange, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const zoom = useRef<ZoomHandle>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const item = items[index];
  const count = items.length;
  useFocusTrap(root, true);

  const go = useCallback((d: number) => onIndexChange((index + d + count) % count), [index, count, onIndexChange]);

  useEffect(() => lockScroll(), []);
  useEffect(() => library.recordView(item.slug), [item.slug]);

  // Preload neighbours' display variants for instant navigation.
  useEffect(() => {
    for (const d of [1, -1]) {
      const n = items[(index + d + count) % count];
      if (n && n.kind === "image") {
        const v = [...n.variants].sort((a, b) => b.width - a.width)[0];
        if (v) new Image().src = v.url;
      }
    }
  }, [index, items, count]);

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.current?.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.("input,textarea,select,[role=slider],[role=menu]")) return;
      // Let the focused video player handle its own keys.
      const inPlayer = Boolean(t?.closest?.('[role="region"][aria-label^="Video player"]'));
      switch (e.key) {
        case "Escape":
          if (document.fullscreenElement) return;
          e.preventDefault();
          onClose();
          break;
        case "ArrowRight":
          if (inPlayer) return;
          e.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
          if (inPlayer) return;
          e.preventDefault();
          go(-1);
          break;
        case "+":
        case "=":
          zoom.current?.zoomIn();
          break;
        case "-":
          zoom.current?.zoomOut();
          break;
        case "0":
          zoom.current?.fit();
          break;
        case "i":
        case "I":
          setInfoOpen((o) => !o);
          break;
        case "f":
        case "F":
          if (!inPlayer) toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, toggleFullscreen]);

  // Horizontal swipe to navigate on touch (only when not zoomed).
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const category = useCategory(item.category);
  const duration = item.video?.duration ?? item.audio?.duration;

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} — ${index + 1} of ${count}`}
      className="fixed inset-0 z-[800] flex animate-fade-in flex-col bg-[rgb(8_8_9/0.96)] text-white [--text-muted:#a4a39f] [--text:#f2f1ee]"
    >
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-4">
        <span className="tabular min-w-[4.5rem] font-mono text-[12px] text-white/55">
          {index + 1} / {count}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{item.title}</p>
          <p className="hidden truncate text-[12px] text-white/55 sm:block">
            {category?.singular} · {item.source.label} · {formatDate(item.datePublished)}
          </p>
        </div>
        <div className="flex items-center gap-0.5 [&_a]:text-white/85 [&_button]:text-white/85">
          <FavoriteButton slug={item.slug} title={item.title} size="icon" />
          <IconButton label="Media information" shortcut="I" pressed={infoOpen} onClick={() => setInfoOpen((o) => !o)}>
            <Info />
          </IconButton>
          <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} shortcut="F" onClick={toggleFullscreen} className="hidden sm:inline-flex">
            {fullscreen ? <Minimize /> : <Maximize />}
          </IconButton>
          <Link href={viewerHref(item.slug)} onClick={onClose} className={buttonClass({ variant: "ghost", size: "sm", className: "hidden hover:bg-white/10 md:inline-flex" })}>
            <ScanSearch /> Open in Viewer
          </Link>
          <Link
            href={viewerHref(item.slug)}
            onClick={onClose}
            aria-label="Open in Media Viewer"
            className={buttonClass({ variant: "ghost", size: "icon", className: "md:hidden" })}
          >
            <ScanSearch />
          </Link>
          <IconButton label="Close" shortcut="Esc" onClick={onClose}>
            <X />
          </IconButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Stage */}
        <div
          className="relative min-w-0 flex-1"
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s || zoomed || item.kind !== "image") return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          <div key={item.slug} className="absolute inset-0 animate-fade-in">
            {item.kind === "image" && <ZoomableImage ref={zoom} item={item} onZoomedChange={setZoomed} />}
            {item.kind === "video" && (
              <div className="flex h-full items-center justify-center p-2 sm:p-6">
                <div className="w-full max-w-[min(100%,calc((100dvh-220px)*16/9))]">
                  <VideoPlayer item={item} autoPlay />
                </div>
              </div>
            )}
            {item.kind === "audio" && (
              <div className="flex h-full items-center justify-center p-6">
                <div className="w-full max-w-3xl [--surface-2:#1a1a1e]">
                  <AudioPlayer item={item} />
                </div>
              </div>
            )}
          </div>
          {count > 1 && (
            <>
              <IconButton
                label="Previous"
                shortcut="←"
                onClick={() => go(-1)}
                variant="glass"
                size="icon-lg"
                className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full text-white sm:inline-flex"
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                label="Next"
                shortcut="→"
                onClick={() => go(1)}
                variant="glass"
                size="icon-lg"
                className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full text-white sm:inline-flex"
              >
                <ChevronRight />
              </IconButton>
            </>
          )}
        </div>

        {/* Info panel */}
        {infoOpen && (
          <aside
            aria-label="Media information"
            className="absolute inset-y-0 right-0 z-10 w-[min(100%,340px)] animate-fade-in overflow-y-auto border-l border-white/10 bg-[rgb(18_18_21/0.92)] p-5 backdrop-blur-xl lg:static"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge className="bg-white/10 text-white/80">{category?.singular}</Badge>
              {item.verification === "community" && <Badge tone="sample">Community made</Badge>}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/70">{item.description}</p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
              {(
                [
                  ["Published", formatDate(item.datePublished)],
                  ["Source", item.source.label],
                  item.width ? ["Resolution", formatResolution(item.width, item.height)] : null,
                  item.width ? ["Aspect", aspectRatioLabel(item.width, item.height)] : null,
                  duration ? ["Duration", formatDuration(duration)] : null,
                  item.video ? ["Frame rate", formatFps(item.video.fps)] : null,
                  ["File", `${item.original.mimeType.split("/")[1]?.toUpperCase()} · ${formatBytes(item.original.bytes)}`],
                ].filter(Boolean) as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-white/45">{k}</dt>
                  <dd className="tabular text-white/90">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/media/${item.slug}`}
                onClick={onClose}
                className={buttonClass({ variant: "secondary", size: "sm", className: "justify-start bg-white/10 text-white hover:bg-white/15" })}
              >
                View details, tags &amp; related media
              </Link>
              <a
                href={item.original.url}
                target="_blank"
                rel="noopener"
                className={buttonClass({ variant: "ghost", size: "sm", className: "justify-start text-white/80 hover:bg-white/10" })}
              >
                <ExternalLink /> Open original file
              </a>
            </div>
          </aside>
        )}
      </div>

      {/* Filmstrip */}
      {count > 1 && (
        <div ref={strip} className="no-scrollbar flex h-[76px] shrink-0 items-center gap-1.5 overflow-x-auto px-4 pt-2 pb-3" role="listbox" aria-label="Media in this set">
          {items.map((m, i) => (
            <button
              key={m.slug}
              type="button"
              role="option"
              aria-selected={i === index}
              aria-label={m.title}
              data-index={i}
              onClick={() => onIndexChange(i)}
              className={cn(
                "h-full w-[88px] shrink-0 overflow-hidden rounded-md transition-[opacity,box-shadow] duration-150",
                i === index ? "opacity-100 ring-2 ring-white" : "opacity-45 hover:opacity-80",
              )}
            >
              <MediaThumb item={m} sizes="96px" aspect="16 / 10" showKind={false} rounded="rounded-md" className="h-full" />
            </button>
          ))}
        </div>
      )}
      {/* Visually hidden live region announces navigation */}
      <p className="sr-only" aria-live="polite">
        {item.title}, {index + 1} of {count}
      </p>
    </div>,
    document.body,
  );
}
