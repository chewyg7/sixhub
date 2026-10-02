/** Formatting helpers shared by server and client code. All pure. */

const DATE_FMT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const DATE_SHORT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
const DATETIME = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function formatDate(iso: string, style: "long" | "short" | "month" = "long"): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return style === "short" ? DATE_SHORT.format(d) : style === "month" ? MONTH_YEAR.format(d) : DATE_FMT.format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATETIME.format(d);
}

/** "3 hours ago" style label. `now` is injectable for deterministic rendering. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.round((now - t) / 1000);
  if (diff < 60) return "Just now";
  const mins = Math.round(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso, "short");
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

export function formatBitrate(bps?: number | null): string {
  if (!bps || !Number.isFinite(bps)) return "—";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(bps >= 10_000_000 ? 1 : 2)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

const pad = (n: number, len = 2) => String(Math.floor(n)).padStart(len, "0");

/** 83.5 → "1:23". Hours are shown only when needed. */
export function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 83.5 → "00:01:23.500" */
export function formatTimecode(seconds: number, withHours = true): string {
  const s = Math.max(0, seconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000 + 1e-6);
  const main = `${pad(m)}:${pad(sec)}.${pad(ms, 3)}`;
  return withHours || h > 0 ? `${pad(h)}:${main}` : main;
}

/** SMPTE-style HH:MM:SS:FF (non-drop). */
export function formatSmpte(frame: number, fps: number): string {
  const f = Math.max(0, Math.floor(frame));
  const nominal = Math.round(fps) || 30;
  const totalSeconds = Math.floor(f / nominal);
  const ff = f % nominal;
  return `${pad(totalSeconds / 3600)}:${pad((totalSeconds % 3600) / 60)}:${pad(totalSeconds % 60)}:${pad(ff)}`;
}

export function formatFps(fps?: number | null): string {
  if (!fps) return "—";
  return Number.isInteger(fps) ? `${fps} fps` : `${fps.toFixed(3).replace(/0+$/, "")} fps`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const KNOWN_RATIOS: [number, string][] = [
  [16 / 9, "16:9"],
  [9 / 16, "9:16"],
  [4 / 3, "4:3"],
  [3 / 4, "3:4"],
  [3 / 2, "3:2"],
  [2 / 3, "2:3"],
  [1, "1:1"],
  [4 / 5, "4:5"],
  [5 / 4, "5:4"],
  [2, "2:1"],
  [3, "3:1"],
  [21 / 9, "21:9"],
  [43 / 18, "21:9"],
  [2.39, "2.39:1"],
];

export function aspectRatioLabel(w?: number, h?: number): string {
  if (!w || !h) return "—";
  const r = w / h;
  for (const [value, label] of KNOWN_RATIOS) {
    if (Math.abs(r - value) / value < 0.012) return label;
  }
  const g = gcd(w, h);
  const a = w / g;
  const b = h / g;
  return a <= 64 && b <= 64 ? `${a}:${b}` : `${r.toFixed(2)}:1`;
}

export type ResolutionTier = "8K" | "5K" | "4K" | "1440p" | "1080p" | "720p" | "SD";
export const RESOLUTION_TIERS: ResolutionTier[] = ["8K", "5K", "4K", "1440p", "1080p", "720p", "SD"];

/** Tier by the long edge; portrait media is judged on its long edge too. */
export function resolutionTier(w?: number, h?: number): ResolutionTier | null {
  if (!w || !h) return null;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  if (long >= 7680) return "8K";
  if (long >= 5120) return "5K";
  if (long >= 3840 || short >= 2160) return "4K";
  if (long >= 2560 || short >= 1440) return "1440p";
  if (long >= 1920 || short >= 1080) return "1080p";
  if (long >= 1280 || short >= 720) return "720p";
  return "SD";
}

export type Orientation = "landscape" | "portrait" | "square";
export function orientationOf(w?: number, h?: number): Orientation | null {
  if (!w || !h) return null;
  const r = w / h;
  if (Math.abs(r - 1) < 0.02) return "square";
  return r > 1 ? "landscape" : "portrait";
}

export function formatResolution(w?: number, h?: number): string {
  return w && h ? `${w.toLocaleString("en-US")} × ${h.toLocaleString("en-US")}` : "—";
}

export function formatMegapixels(w?: number, h?: number): string {
  return w && h ? `${((w * h) / 1_000_000).toFixed(1)} MP` : "—";
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
