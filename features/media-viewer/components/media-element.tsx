"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { Pane, ViewerMedia } from "../types";
import { useViewer } from "../store";
import { fpsOf, frameAt, registerElement, syncB } from "../controller";
import { snapFps } from "../lib/mp4";

let pendingSeek: number | null = null;
/** Seek applied once pane A's metadata loads (used by shared ?t= links). */
export function setPendingSeek(t: number | null) {
  pendingSeek = t;
}

interface Props {
  pane: Pane;
  media: ViewerMedia;
  style?: CSSProperties;
  className?: string;
  /** Rendered as a passive copy (e.g. B inside the overlay) — not registered as the pane's element. */
  passive?: boolean;
}

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number; presentedFrames: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

export function MediaElement({ pane, media, style, className, passive }: Props) {
  const ref = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  const primary = pane === "a" && !passive;

  useEffect(() => {
    if (passive) return;
    registerElement(pane, ref.current);
    return () => registerElement(pane, null);
  }, [pane, passive, media.id]);

  // Frame-accurate clock for pane A via requestVideoFrameCallback.
  useEffect(() => {
    const v = ref.current as FrameCallbackVideo | null;
    if (!primary || !(v instanceof HTMLVideoElement)) return;
    if (!v.requestVideoFrameCallback) {
      const onTime = () => useViewer.getState().setPlayback({ time: v.currentTime, frame: frameAt(v.currentTime, fpsOf()) });
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("seeked", onTime);
      return () => {
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("seeked", onTime);
      };
    }
    let id = 0;
    let lastTime = -1;
    let lastPresented = -1;
    const deltas: number[] = [];
    const cb = (_now: number, meta: { mediaTime: number; presentedFrames: number }) => {
      const s = useViewer.getState();
      const fps = s.a?.meta.fps ?? 30;
      s.setPlayback({ time: meta.mediaTime, frame: Math.round(meta.mediaTime * fps) });
      // Measure the frame rate from consecutive presented frames when metadata doesn't provide it.
      if (!v.paused && lastPresented >= 0 && meta.presentedFrames === lastPresented + 1 && meta.mediaTime > lastTime) {
        deltas.push(meta.mediaTime - lastTime);
        const src = s.a?.meta.fpsSource;
        if (deltas.length >= 24 && (!src || src === "assumed" || src === "measured")) {
          const sorted = [...deltas].sort((x, y) => x - y);
          const median = sorted[Math.floor(sorted.length / 2)];
          if (median > 0) s.updateMeta("a", { fps: snapFps(1 / median, 0.01), fpsSource: "measured" });
          deltas.length = 0;
        }
      }
      lastTime = meta.mediaTime;
      lastPresented = meta.presentedFrames;
      if (!v.paused) syncB();
      id = v.requestVideoFrameCallback!(cb);
    };
    id = v.requestVideoFrameCallback(cb);
    return () => v.cancelVideoFrameCallback?.(id);
  }, [primary, media.id]);

  const onError = () => {
    const s = useViewer.getState();
    // Remote sources without CORS headers: retry without CORS (display only, pixels unreadable).
    if (media.origin === "url" && media.cors) {
      s.setMedia(pane, { cors: false });
      return;
    }
    if (!passive)
      s.setError(
        pane,
        media.origin === "url"
          ? "This URL couldn't be loaded as media. Check that it links directly to an image, video or audio file."
          : "This file couldn't be decoded by the browser.",
      );
  };

  const cross = media.cors && media.origin !== "local" && media.origin !== "capture" ? "anonymous" : undefined;

  if (media.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- analysis view needs the exact source file
      <img
        key={`${media.id}-${media.cors}`}
        ref={(el) => {
          ref.current = el;
        }}
        src={media.src}
        alt={media.item?.alt ?? media.title}
        crossOrigin={cross}
        draggable={false}
        decoding="async"
        className={className}
        style={style}
        onLoad={(e) => {
          if (passive) return;
          const el = e.currentTarget;
          const m = useViewer.getState()[pane]?.meta;
          if (m?.width !== el.naturalWidth || m?.height !== el.naturalHeight) useViewer.getState().updateMeta(pane, { width: el.naturalWidth, height: el.naturalHeight });
        }}
        onError={onError}
      />
    );
  }

  return (
    <video
      key={`${media.id}-${media.cors}`}
      ref={(el) => {
        ref.current = el;
      }}
      src={media.src}
      poster={media.poster}
      crossOrigin={cross}
      preload="auto"
      playsInline
      disablePictureInPicture={passive}
      muted={pane === "b"}
      className={className}
      style={style}
      onLoadedMetadata={(e) => {
        if (passive) return;
        const v = e.currentTarget;
        const s = useViewer.getState();
        const meta = s[pane]?.meta;
        s.updateMeta(pane, {
          width: v.videoWidth,
          height: v.videoHeight,
          duration: v.duration,
          ...(meta?.fps ? {} : { fps: 30, fpsSource: "assumed" as const }),
          ...(meta?.bytes && v.duration ? { bitrate: meta.bitrate ?? Math.round((meta.bytes * 8) / v.duration) } : {}),
        });
        if (pane === "a") {
          v.playbackRate = s.playback.rate;
          v.volume = s.playback.volume;
          v.muted = s.playback.muted;
          v.loop = s.playback.loop;
          s.setPlayback({ duration: v.duration });
          if (pendingSeek !== null) {
            v.currentTime = Math.min(pendingSeek, v.duration);
            pendingSeek = null;
          }
        } else syncB(true);
      }}
      onDurationChange={(e) => primary && useViewer.getState().setPlayback({ duration: e.currentTarget.duration })}
      onPlay={() => {
        if (!primary) return;
        useViewer.getState().setPlayback({ playing: true });
        syncB(true);
      }}
      onPause={(e) => {
        if (!primary) return;
        useViewer.getState().setPlayback({ playing: false, time: e.currentTarget.currentTime });
        syncB(true);
      }}
      onEnded={() => primary && useViewer.getState().setPlayback({ playing: false })}
      onSeeked={() => primary && syncB(true)}
      onRateChange={(e) => primary && useViewer.getState().setPlayback({ rate: e.currentTarget.playbackRate })}
      onVolumeChange={(e) => primary && useViewer.getState().setPlayback({ volume: e.currentTarget.volume, muted: e.currentTarget.muted })}
      onProgress={(e) => {
        if (!primary) return;
        const b = e.currentTarget.buffered;
        useViewer.getState().setPlayback({ buffered: Array.from({ length: b.length }, (_, i) => [b.start(i), b.end(i)] as [number, number]) });
      }}
      onWaiting={() => primary && useViewer.getState().setPlayback({ waiting: true })}
      onPlaying={() => primary && useViewer.getState().setPlayback({ waiting: false })}
      onCanPlay={() => primary && useViewer.getState().setPlayback({ waiting: false })}
      onError={onError}
    />
  );
}
