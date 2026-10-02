"use client";

import { useEffect, useRef } from "react";
import { AudioLines } from "lucide-react";
import type { ViewerMedia } from "../types";
import { useViewer } from "../store";
import { player, registerElement } from "../controller";
import { useWaveform, WaveformCanvas } from "@/components/media/player/waveform";
import { Skeleton } from "@/components/ui/states";

/** Audio in the viewer: cover art plus a full-width, seekable waveform. */
export function AudioStage({ media }: { media: ViewerMedia }) {
  const ref = useRef<HTMLAudioElement>(null);
  const time = useViewer((s) => s.playback.time);
  const duration = useViewer((s) => s.playback.duration || media.meta.duration || 0);
  const wave = useWaveform(media.file ?? media.src);
  const cover = media.item ? [...media.item.variants].sort((a, b) => b.width - a.width)[0]?.url : undefined;

  useEffect(() => {
    registerElement("a", ref.current);
    return () => registerElement("a", null);
  }, [media.id]);

  // Smooth playhead while playing.
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    let raf = 0;
    const tick = () => {
      if (!a.paused) useViewer.getState().setPlayback({ time: a.currentTime });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [media.id]);

  useEffect(() => {
    if (wave.data) useViewer.getState().updateMeta("a", { sampleRate: wave.data.sampleRate, channels: wave.data.channels });
  }, [wave.data]);

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    player.seek(((e.clientX - r.left) / r.width) * duration);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6 sm:p-10">
      <audio
        ref={ref}
        src={media.src}
        preload="auto"
        onLoadedMetadata={(e) => {
          const s = useViewer.getState();
          const a = e.currentTarget;
          a.playbackRate = s.playback.rate;
          a.volume = s.playback.volume;
          a.muted = s.playback.muted;
          a.loop = s.playback.loop;
          s.setPlayback({ duration: a.duration });
          s.updateMeta("a", { duration: a.duration, ...(media.meta.bytes && !media.meta.bitrate ? { bitrate: Math.round((media.meta.bytes * 8) / a.duration) } : {}) });
        }}
        onPlay={() => useViewer.getState().setPlayback({ playing: true })}
        onPause={(e) => useViewer.getState().setPlayback({ playing: false, time: e.currentTarget.currentTime })}
        onEnded={() => useViewer.getState().setPlayback({ playing: false })}
        onSeeked={(e) => useViewer.getState().setPlayback({ time: e.currentTarget.currentTime })}
        onRateChange={(e) => useViewer.getState().setPlayback({ rate: e.currentTarget.playbackRate })}
        onVolumeChange={(e) => useViewer.getState().setPlayback({ volume: e.currentTarget.volume, muted: e.currentTarget.muted })}
        onError={() => useViewer.getState().setError("a", "This audio file couldn't be decoded by the browser.")}
      />
      <div className="size-40 overflow-hidden rounded-xl bg-surface-3 shadow-lg sm:size-56">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- cover art variant
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <AudioLines className="size-10" />
          </div>
        )}
      </div>
      <div className="relative h-32 w-full max-w-5xl cursor-pointer" onPointerDown={seekFromPointer} role="presentation">
        {wave.data ? (
          <WaveformCanvas data={wave.data} progress={duration ? time / duration : 0} color="rgba(255,255,255,0.28)" playedColor="#ef6f4e" />
        ) : wave.error ? (
          <p className="flex h-full items-center justify-center text-[13px] text-muted">Waveform unavailable ({wave.error})</p>
        ) : (
          <Skeleton className="h-full w-full" />
        )}
        {duration > 0 && <div className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: `${(time / duration) * 100}%` }} />}
      </div>
    </div>
  );
}
