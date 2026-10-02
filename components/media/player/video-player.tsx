"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, PictureInPicture2, Play, ScanSearch, Volume1, Volume2, VolumeX } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { ErrorState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { viewerHref } from "../media-links";
import { usePipSupported } from "@/lib/hooks/use-client";
import { Scrubber } from "./scrubber";

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

interface Props {
  item: MediaItem;
  autoPlay?: boolean;
  className?: string;
  /** Fit inside the parent (lightbox) rather than using the video's aspect ratio. */
  fill?: boolean;
}

export function VideoPlayer({ item, autoPlay, className, fill }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(item.video?.duration ?? 0);
  const [buffered, setBuffered] = useState<[number, number][]>([]);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [started, setStarted] = useState(Boolean(autoPlay));
  const fps = item.video?.fps ?? 30;
  const pipSupported = usePipSupported();

  // Smooth time updates while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (video.current) setCurrent(video.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const poke = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (video.current && !video.current.paused) setControlsVisible(false);
    }, 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    setStarted(true);
    if (v.paused || v.ended) v.play().catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    else v.pause();
  }, []);

  const seek = useCallback((t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, t), v.duration || t);
    setCurrent(v.currentTime);
  }, []);

  const stepFrame = useCallback(
    (dir: 1 | -1) => {
      const v = video.current;
      if (!v) return;
      v.pause();
      const frame = Math.floor(v.currentTime * fps + 1e-3);
      seek((frame + dir + 0.5) / fps);
    },
    [fps, seek],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('[role="slider"],input,select')) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") {
      e.preventDefault();
      toggle();
    } else if (k === "arrowright" || k === "l") {
      e.preventDefault();
      seek(current + (k === "l" ? 10 : 5));
    } else if (k === "arrowleft" || k === "j") {
      e.preventDefault();
      seek(current - (k === "j" ? 10 : 5));
    } else if (k === "." || k === ",") {
      e.preventDefault();
      stepFrame(k === "." ? 1 : -1);
    } else if (k === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (k === "m") {
      e.preventDefault();
      setMuted((m) => {
        if (video.current) video.current.muted = !m;
        return !m;
      });
    } else return;
    e.stopPropagation();
    poke();
  };

  const src = item.original.url;
  const poster = item.variants.find((v) => v.width >= 960)?.url ?? item.poster?.url;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={root}
      tabIndex={0}
      role="region"
      aria-label={`Video player: ${item.title}`}
      onKeyDown={onKeyDown}
      onPointerMove={poke}
      onPointerLeave={() => playing && setControlsVisible(false)}
      className={cn("group/player relative overflow-hidden bg-black outline-none", fill ? "h-full w-full" : "rounded-xl", !controlsVisible && playing && "cursor-none", className)}
      style={fill ? undefined : { aspectRatio: `${item.width ?? 16} / ${item.height ?? 9}` }}
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        autoPlay={autoPlay}
        className="absolute inset-0 h-full w-full object-contain"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true);
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          if (video.current) setCurrent(video.current.currentTime);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => !playing && setCurrent(e.currentTarget.currentTime)}
        onSeeked={(e) => setCurrent(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          setBuffered(Array.from({ length: b.length }, (_, i) => [b.start(i), b.end(i)] as [number, number]));
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        onError={() => setError("This video couldn't be loaded.")}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <ErrorState
            compact
            title="Playback error"
            description={error}
            onRetry={() => {
              setError(null);
              video.current?.load();
            }}
            className="border-white/10 bg-black/40"
          />
        </div>
      )}

      {!started && !error && (
        <button type="button" onClick={toggle} aria-label={`Play ${item.title}`} className="absolute inset-0 flex items-center justify-center">
          <span className="glass-2 flex size-16 items-center justify-center rounded-full text-white transition-transform duration-200 group-hover/player:scale-105">
            <Play className="ml-1 size-6 fill-current" />
          </span>
        </button>
      )}

      {waiting && playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-label="Buffering" />
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-2 text-white transition-opacity duration-200",
          controlsVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0",
          !started && "pointer-events-none opacity-0",
        )}
      >
        <Scrubber duration={duration} current={current} buffered={buffered} onSeek={seek} storyboard={item.storyboard} label={`Seek ${item.title}`} />
        <div className="mt-1 flex items-center gap-0.5 [&_button]:text-white/90 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
          <IconButton label={playing ? "Pause" : "Play"} shortcut="K" size="icon-sm" onClick={toggle}>
            {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </IconButton>
          <IconButton label="Previous frame" shortcut="," size="icon-sm" onClick={() => stepFrame(-1)} className="hidden sm:inline-flex">
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next frame" shortcut="." size="icon-sm" onClick={() => stepFrame(1)} className="hidden sm:inline-flex">
            <ChevronRight />
          </IconButton>
          <div className="group/vol flex items-center">
            <IconButton
              label={muted ? "Unmute" : "Mute"}
              shortcut="M"
              size="icon-sm"
              onClick={() => {
                if (video.current) video.current.muted = !video.current.muted;
              }}
            >
              <VolumeIcon />
            </IconButton>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => {
                if (!video.current) return;
                video.current.volume = Number(e.target.value);
                video.current.muted = Number(e.target.value) === 0;
              }}
              className="range w-0 opacity-0 transition-[width,opacity] duration-200 [--text:white] group-focus-within/vol:w-20 group-focus-within/vol:opacity-100 group-hover/vol:w-20 group-hover/vol:opacity-100"
              style={{ "--fill": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
            />
          </div>
          <span className="tabular ml-2 font-mono text-[12px] text-white/85">
            {formatDuration(current)} <span className="text-white/45">/ {formatDuration(duration)}</span>
          </span>
          <div className="flex-1" />
          <Menu
            align="end"
            placement="above"
            minWidth={140}
            items={[
              { type: "label", label: "Speed" },
              ...RATES.map((r) => ({ label: r === 1 ? "Normal" : `${r}×`, checked: rate === r, onSelect: () => video.current && (video.current.playbackRate = r) })),
            ]}
            trigger={(p) => (
              <button {...p} type="button" aria-label={`Playback speed ${rate}×`} className={buttonClass({ variant: "ghost", size: "xs", className: "tabular font-mono" })}>
                {rate}×
              </button>
            )}
          />
          {pipSupported && (
            <IconButton
              label="Picture in picture"
              size="icon-sm"
              onClick={() => {
                if (document.pictureInPictureElement) document.exitPictureInPicture();
                else video.current?.requestPictureInPicture().catch(() => {});
              }}
              className="hidden sm:inline-flex"
            >
              <PictureInPicture2 />
            </IconButton>
          )}
          <Tooltip content="Open in Media Viewer at this time">
            <Link
              href={viewerHref(item.slug, { t: current })}
              aria-label="Open in Media Viewer at this time"
              className={buttonClass({ variant: "ghost", size: "icon-sm", className: "text-white/90 hover:bg-white/10" })}
            >
              <ScanSearch />
            </Link>
          </Tooltip>
          <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} shortcut="F" size="icon-sm" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}
