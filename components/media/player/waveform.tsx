"use client";

import { useEffect, useRef, useState } from "react";

export interface WaveformData {
  /** Interleaved min/max pairs in [-1, 1]. */
  peaks: Float32Array;
  buckets: number;
  duration: number;
  sampleRate: number;
  channels: number;
}

const cache = new Map<string, Promise<WaveformData>>();

/** Decode audio with the Web Audio API and reduce it to min/max peaks. */
export function computeWaveform(source: string | Blob, buckets = 1600): Promise<WaveformData> {
  const key = typeof source === "string" ? `${source}#${buckets}` : null;
  if (key && cache.has(key)) return cache.get(key)!;
  const job = (async () => {
    const buf = typeof source === "string" ? await (await fetch(source)).arrayBuffer() : await source.arrayBuffer();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const audio = await ctx.decodeAudioData(buf);
      const ch0 = audio.getChannelData(0);
      const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
      const size = Math.floor(ch0.length / buckets) || 1;
      const peaks = new Float32Array(buckets * 2);
      for (let b = 0; b < buckets; b++) {
        let min = 1;
        let max = -1;
        const start = b * size;
        const end = Math.min(ch0.length, start + size);
        // Sample every few frames: plenty for display, much faster on long files.
        const stride = Math.max(1, Math.floor(size / 400));
        for (let i = start; i < end; i += stride) {
          const v = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        peaks[b * 2] = min;
        peaks[b * 2 + 1] = max;
      }
      return { peaks, buckets, duration: audio.duration, sampleRate: audio.sampleRate, channels: audio.numberOfChannels };
    } finally {
      ctx.close().catch(() => {});
    }
  })();
  if (key) {
    cache.set(key, job);
    job.catch(() => cache.delete(key));
  }
  return job;
}

export function useWaveform(source: string | Blob | null | undefined) {
  const [state, setState] = useState<{ data: WaveformData | null; error: string | null; for: string | Blob | null }>({ data: null, error: null, for: null });
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    computeWaveform(source).then(
      (data) => !cancelled && setState({ data, error: null, for: source }),
      (e: Error) => !cancelled && setState({ data: null, error: e.message || "Could not decode audio", for: source }),
    );
    return () => {
      cancelled = true;
    };
  }, [source]);
  const current = state.for === source;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: Boolean(source) && !current };
}

/** Canvas waveform that fills its parent. `progress` is 0..1. */
export function WaveformCanvas({
  data,
  progress,
  className,
  color = "rgba(255,255,255,0.32)",
  playedColor = "rgba(255,255,255,0.9)",
}: {
  data: WaveformData;
  progress: number;
  className?: string;
  color?: string;
  playedColor?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const bars = Math.floor(size.w / 3);
    const mid = c.height / 2;
    const playedBars = Math.floor(bars * progress);
    for (let i = 0; i < bars; i++) {
      const b0 = Math.floor((i / bars) * data.buckets);
      const b1 = Math.max(b0 + 1, Math.floor(((i + 1) / bars) * data.buckets));
      let peak = 0;
      for (let b = b0; b < b1; b++) peak = Math.max(peak, Math.abs(data.peaks[b * 2]), Math.abs(data.peaks[b * 2 + 1]));
      const h = Math.max(1 * dpr, peak * c.height * 0.92);
      ctx.fillStyle = i < playedBars ? playedColor : color;
      ctx.fillRect(i * 3 * dpr, mid - h / 2, 2 * dpr, h);
    }
  }, [data, progress, size, color, playedColor]);

  return <canvas ref={ref} className={className} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden />;
}
