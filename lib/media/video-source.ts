import type { MediaItem } from "@/types/content";

/**
 * Picking which file of a video to play. Big trailers come in several sizes
 * (the 2160p original plus lighter encodes); phones get one they can decode
 * and hold in memory, computers get full quality, and anyone can switch.
 */

export interface VideoSource {
  url: string;
  height: number;
  width: number;
  /** "2160p", "1080p"… */
  label: string;
  /** RFC 6381 codec string when known, used to skip files this browser can't decode. */
  codec?: string;
  bytes?: number;
  original: boolean;
}

/** Codec string for a file described by its probed codec name (e.g. "AV1 (Main)"). */
function codecFor(item: MediaItem): string | undefined {
  const v = item.video;
  if (!v) return undefined;
  if (v.codecString) return v.codecString;
  const name = v.videoCodec?.toLowerCase() ?? "";
  if (name.startsWith("av1")) return "av01.0.12M.08";
  if (name.startsWith("hevc") || name.startsWith("h.265")) return "hvc1.1.6.L153.B0";
  if (name.startsWith("vp9")) return "vp09.00.50.08";
  return undefined; // H.264: every browser plays it
}

const label = (h: number) => (h >= 2000 ? "2160p" : h >= 1400 ? "1440p" : `${h}p`);

/** Every file of a video, largest first. */
export function videoSources(item: MediaItem): VideoSource[] {
  const h = item.height ?? item.original.height ?? 1080;
  const w = item.width ?? item.original.width ?? Math.round((h * 16) / 9);
  const list: VideoSource[] = [{ url: item.original.url, width: w, height: h, label: label(h), codec: codecFor(item), bytes: item.original.bytes, original: true }];
  for (const r of item.renditions ?? []) list.push({ url: r.url, width: r.width, height: r.height, label: label(r.height), bytes: r.bytes, original: false });
  return list.sort((a, b) => b.height - a.height);
}

const canPlay = new Map<string, boolean>();
/** Whether this browser can decode the file (unknown codec counts as yes). */
export function playable(s: VideoSource): boolean {
  if (!s.codec || typeof document === "undefined") return true;
  if (!canPlay.has(s.codec)) {
    const type = `video/mp4; codecs="${s.codec}"`;
    const ok = document.createElement("video").canPlayType(type) !== "" || (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(type));
    canPlay.set(s.codec, ok);
  }
  return canPlay.get(s.codec)!;
}

/** Tallest video this device should play automatically: 1080p on phones, tablets and data saver; full quality elsewhere. */
export function deviceMaxHeight(): number {
  if (typeof window === "undefined") return 1080;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return 720;
  const small = Math.min(screen.width, screen.height) < 900;
  const touch = matchMedia("(pointer: coarse)").matches;
  const lowMemory = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
  return small || touch || lowMemory ? 1080 : Infinity;
}

/** The file to play: the chosen height if given, else the best this device handles. */
export function pickSource(sources: VideoSource[], preferred?: number | "auto"): VideoSource | undefined {
  const ok = sources.filter(playable);
  const pool = ok.length ? ok : sources;
  if (typeof preferred === "number") return pool.find((s) => s.height === preferred) ?? pool.find((s) => s.height < preferred) ?? pool[pool.length - 1];
  const max = deviceMaxHeight();
  return pool.find((s) => s.height <= max) ?? pool[pool.length - 1];
}

/* The quality someone picked is remembered for every video. */
const QUALITY_KEY = "gh:video-quality";
export function savedQuality(): number | "auto" {
  try {
    const v = Number(localStorage.getItem(QUALITY_KEY));
    return v > 0 ? v : "auto";
  } catch {
    return "auto";
  }
}
export function saveQuality(q: number | "auto") {
  try {
    if (q === "auto") localStorage.removeItem(QUALITY_KEY);
    else localStorage.setItem(QUALITY_KEY, String(q));
  } catch {}
}
