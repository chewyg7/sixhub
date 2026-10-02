"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/states";
import { Scrubber } from "./scrubber";
import { useWaveform, WaveformCanvas } from "./waveform";
import { ResponsiveImage } from "../responsive-image";

/** Audio player with cover art and a decoded waveform scrubber. */
export function AudioPlayer({ item, className, compact }: { item: MediaItem; className?: string; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(item.audio?.duration ?? 0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);
  const wave = useWaveform(item.original.url);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (audio.current) setCurrent(audio.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setError(true));
    else a.pause();
  };
  const seek = (t: number) => {
    if (!audio.current) return;
    audio.current.currentTime = t;
    setCurrent(t);
  };

  return (
    <div
      className={cn("flex w-full flex-col gap-5 sm:flex-row sm:items-center", compact && "gap-4", className)}
      onKeyDown={(e) => {
        if (e.key === " " && !(e.target as HTMLElement).closest("button,input")) {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div className={cn("relative aspect-square shrink-0 overflow-hidden rounded-lg bg-surface-2 shadow-lg", compact ? "w-28" : "w-full max-w-[280px] self-center sm:w-56")}>
        <ResponsiveImage item={item} sizes="280px" />
      </div>
      <div className="min-w-0 flex-1">
        <audio
          ref={audio}
          src={item.original.url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => !playing && setCurrent(e.currentTarget.currentTime)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onError={() => setError(true)}
        />
        <div className="relative h-20">
          {wave.data ? (
            <Scrubber
              duration={duration}
              current={current}
              onSeek={seek}
              label={`Seek ${item.title}`}
              height="tall"
              className="h-20"
              background={
                <WaveformCanvas data={wave.data} progress={duration ? current / duration : 0} playedColor="var(--text)" color="color-mix(in srgb, var(--text) 28%, transparent)" />
              }
            />
          ) : wave.error ? (
            <div className="flex h-full items-center">
              <Scrubber duration={duration} current={current} onSeek={seek} label={`Seek ${item.title}`} className="w-full" />
            </div>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <IconButton label={playing ? "Pause" : "Play"} variant="primary" size="icon" onClick={toggle} className="rounded-full">
            {playing ? <Pause className="fill-current" /> : <Play className="ml-0.5 fill-current" />}
          </IconButton>
          <span className="tabular ml-1 font-mono text-[12.5px] text-muted">
            {formatDuration(current)} / {formatDuration(duration)}
          </span>
          <div className="flex-1" />
          <IconButton
            label={muted ? "Unmute" : "Mute"}
            size="icon-sm"
            onClick={() => {
              if (audio.current) audio.current.muted = !audio.current.muted;
            }}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </IconButton>
        </div>
        {error && <p className="mt-2 text-[12.5px] text-danger">This audio file couldn&apos;t be played.</p>}
      </div>
    </div>
  );
}
