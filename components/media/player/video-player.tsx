"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Captions, CaptionsOff, ChevronLeft, ChevronRight, Maximize, Minimize, Pause, PictureInPicture2, Play, ScanSearch, Volume1, Volume2, VolumeX } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { ErrorState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { viewerHrefFor } from "../media-links";
import { usePipSupported } from "@/lib/hooks/use-client";
import { pickSource, playable, saveQuality, savedQuality, videoSources } from "@/lib/media/video-source";
import { Scrubber } from "./scrubber";

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const CAPTIONS_KEY = "gh:captions";

const captionListeners = new Set<() => void>();
const readCaptions = () => {
  try {
    return localStorage.getItem(CAPTIONS_KEY) === "1";
  } catch {
    return false;
  }
};
/** Subtitles on/off, shared by every player and kept across visits. */
function useCaptionsPref(): [boolean, () => void] {
  const on = useSyncExternalStore(
    (l) => {
      captionListeners.add(l);
      return () => captionListeners.delete(l);
    },
    readCaptions,
    () => false,
  );
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(CAPTIONS_KEY, readCaptions() ? "0" : "1");
    } catch {}
    captionListeners.forEach((l) => l());
  }, []);
  return [on, toggle];
}

const qualityListeners = new Set<() => void>();
/** The picked quality ("auto" or a height), shared by every player and kept across visits. */
function useQualityPref(): [number | "auto", (q: number | "auto") => void] {
  const q = useSyncExternalStore(
    (l) => {
      qualityListeners.add(l);
      return () => qualityListeners.delete(l);
    },
    savedQuality,
    () => "auto" as const,
  );
  const set = useCallback((next: number | "auto") => {
    saveQuality(next);
    qualityListeners.forEach((l) => l());
  }, []);
  return [q, set];
}

const noopSubscribe = () => () => {};
/** False while hydrating: the file is only chosen in the browser, where the device is known. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Cue text without WebVTT markup (<i>, <c.yellow>, <v Name>…). */
const plainCue = (t: string) => t.replace(/<[^>]+>/g, "").trim();

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
  const hydrated = useHydrated();
  const [quality, setQuality] = useQualityPref();
  const sources = videoSources(item);
  // Files that failed here are skipped, so playback falls back to the next one down.
  const [failed, setFailed] = useState<string[]>([]);
  const usable = sources.filter((s) => !failed.includes(s.url));
  const source = hydrated ? pickSource(usable, quality) : undefined;
  // Where to pick up after switching quality (or falling back).
  const resume = useRef<{ t: number; play: boolean } | null>(null);
  const switchTo = (q: number | "auto") => {
    const v = video.current;
    if (v) resume.current = { t: v.currentTime, play: !v.paused };
    setQuality(q);
  };
  const subtitles = item.subtitles ?? [];
  const hasSubs = subtitles.length > 0;
  const [captionsOn, toggleCaptions] = useCaptionsPref();
  const [cue, setCue] = useState("");
  // The track runs "hidden": the browser keeps the active cues, and they're drawn in our own style above the controls.
  useEffect(() => {
    const track = video.current?.textTracks[0];
    if (!track || !hasSubs) return;
    track.mode = captionsOn ? "hidden" : "disabled";
    const update = () => setCue(captionsOn ? Array.from(track.activeCues ?? [], (c) => plainCue((c as VTTCue).text)).join("\n") : "");
    track.addEventListener("cuechange", update);
    update();
    return () => track.removeEventListener("cuechange", update);
  }, [captionsOn, hasSubs, item.slug]);

  // Time updates while playing, about 15 times a second: smooth enough for the clock and scrubber
  // without re-rendering the player on every frame (heavy on phones).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (video.current && now - last > 66) {
        last = now;
        setCurrent(video.current.currentTime);
      }
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
    } else if (k === "c" && hasSubs) {
      e.preventDefault();
      toggleCaptions();
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
        key={item.slug}
        ref={video}
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
        src={source?.url}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          const r = resume.current;
          resume.current = null;
          if (r) {
            v.currentTime = Math.min(r.t, v.duration || r.t);
            if (r.play) v.play().catch(() => {});
          }
        }}
        onError={(e) => {
          const v = e.currentTarget;
          if (!source || !v.error) return;
          // Try the next file down (e.g. a phone that can't decode the 2160p original), from the same spot.
          const next = usable.find((s) => s.url !== source.url && s.height < source.height && playable(s));
          if (next) {
            resume.current = { t: v.currentTime, play: !v.paused || started };
            setFailed((f) => [...f, source.url]);
            return;
          }
          setError(
            v.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
              ? "This device can't play this video's format. Try another browser, or a lower quality."
              : "This video couldn't be loaded. Check your connection and try again.",
          );
        }}
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
      >
        {subtitles.map((s) => (
          <track key={s.url} kind="subtitles" src={s.url} srcLang={s.lang} label={s.label} />
        ))}
      </video>

      {cue && (
        <div
          aria-live="off"
          className={cn("pointer-events-none absolute inset-x-0 flex justify-center px-4 transition-[bottom] duration-200 sm:px-10", controlsVisible || !playing ? "bottom-[76px]" : "bottom-6")}
        >
          <p className="max-w-[min(90%,900px)] rounded-md bg-black/72 px-3 py-1.5 text-center text-[clamp(13px,2.1vw,26px)] leading-snug font-semibold whitespace-pre-line text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
            {cue}
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <ErrorState
            compact
            title="Playback error"
            description={error}
            onRetry={() => {
              setError(null);
              setFailed([]);
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
          {sources.length > 1 && (
            <Menu
              align="end"
              placement="above"
              minWidth={150}
              items={[
                { type: "label", label: "Quality" },
                { label: `Auto${quality === "auto" && source ? ` (${source.label})` : ""}`, checked: quality === "auto", onSelect: () => switchTo("auto") },
                ...sources.filter(playable).map((s) => ({ label: s.label, checked: quality === s.height, onSelect: () => switchTo(s.height) })),
              ]}
              trigger={(p) => (
                <button {...p} type="button" aria-label={`Quality: ${source?.label ?? "auto"}`} className={buttonClass({ variant: "ghost", size: "xs", className: "tabular font-mono" })}>
                  {source ? (source.height >= 2000 ? "4K" : source.label) : "Auto"}
                </button>
              )}
            />
          )}
          {hasSubs && (
            <IconButton label={captionsOn ? "Turn subtitles off" : "Turn subtitles on"} shortcut="C" size="icon-sm" pressed={captionsOn} onClick={toggleCaptions}>
              {captionsOn ? <Captions /> : <CaptionsOff />}
            </IconButton>
          )}
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
              href={viewerHrefFor(item, { t: current })}
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
