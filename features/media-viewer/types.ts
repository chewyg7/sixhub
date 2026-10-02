import type { MediaItem, MediaKind, Storyboard } from "@/types/content";

export type Pane = "a" | "b";
export type Rotation = 0 | 90 | 180 | 270;

/** Technical information known about a loaded source. Filled progressively. */
export interface MediaMeta {
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  /** Where the frame rate came from — shown so users know how exact it is. */
  fpsSource?: "metadata" | "container" | "measured" | "assumed";
  frameCount?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrate?: number;
  bytes?: number;
  mimeType?: string;
  filename?: string;
  source?: string;
  sourceUrl?: string;
  released?: string;
  sampleRate?: number;
  channels?: number;
  lastModified?: number;
  hasAlpha?: boolean;
}

/** Anything the viewer can display: archive items, local files, URLs and captures. */
export interface ViewerMedia {
  /** Unique per load. */
  id: string;
  kind: MediaKind;
  origin: "archive" | "local" | "url" | "capture";
  src: string;
  title: string;
  slug?: string;
  item?: MediaItem;
  file?: File;
  poster?: string;
  /** Small image for the navigator / lists. */
  thumb?: string;
  storyboard?: Storyboard;
  /** Pixels are readable (same-origin or CORS-enabled): capture, crop export and colour picking work. */
  cors: boolean;
  meta: MediaMeta;
}

export interface ViewState {
  /** Screen pixels per source pixel. */
  scale: number;
  /** Source point at the stage centre, normalized 0..1. */
  cx: number;
  cy: number;
  /** `fit`/`fill` track the stage size; `custom` is user-set. */
  mode: "fit" | "fill" | "custom";
  /** Animate the next transform change (preset buttons), not wheel/drag. */
  animate?: boolean;
}

export interface Transform {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
}

export interface Adjustments {
  brightness: number; // %
  contrast: number; // %
  saturation: number; // %
  exposure: number; // EV stops
  sharpness: number; // 0..100
  grayscale: number; // %
  invert: boolean;
}

export const DEFAULT_ADJUST: Adjustments = { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, grayscale: 0, invert: false };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AspectKey = "free" | "16:9" | "4:3" | "1:1" | "9:16" | "custom";

export interface CropState {
  aspect: AspectKey;
  custom: [number, number];
  /** Selection in source pixels of pane A. */
  rect: Rect | null;
}

export type CompareMode = "side" | "overlay" | "slider";

export interface CompareState {
  enabled: boolean;
  mode: CompareMode;
  /** Side-by-side: zoom/pan both panes together. */
  sync: boolean;
  opacity: number;
  split: number;
  blend: "normal" | "difference";
  /** Keep B's playback locked to A (plus offset). */
  linkPlayback: boolean;
  offset: number;
}

export interface Capture {
  id: string;
  url: string;
  blob: Blob;
  width: number;
  height: number;
  title: string;
  time?: number;
  frame?: number;
  createdAt: number;
}

export interface PlaybackState {
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  /** Current presented frame (from requestVideoFrameCallback when available). */
  frame: number;
  buffered: [number, number][];
  waiting: boolean;
}

export interface CursorInfo {
  x: number;
  y: number;
  inside: boolean;
  color?: string;
}
