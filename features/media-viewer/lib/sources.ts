import type { MediaItem, MediaKind } from "@/types/content";
import { smallestVariant } from "@/lib/media/variants";
import type { Capture, MediaMeta, ViewerMedia } from "../types";
import { fileReader, httpReader, readContainer } from "./mp4";

const uid = () => Math.random().toString(36).slice(2, 10);

const EXT_KIND: Record<string, MediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  avif: "image",
  gif: "image",
  bmp: "image",
  svg: "image",
  tif: "image",
  tiff: "image",
  mp4: "video",
  m4v: "video",
  webm: "video",
  mov: "video",
  ogv: "video",
  mkv: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  opus: "audio",
};

export function kindFromName(name: string, mime = ""): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = name.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return EXT_KIND[ext] ?? null;
}

export function fromArchive(item: MediaItem): ViewerMedia {
  const poster = item.kind === "image" ? undefined : [...item.variants].sort((a, b) => b.width - a.width)[0]?.url;
  const meta: MediaMeta = {
    width: item.width,
    height: item.height,
    bytes: item.original.bytes,
    mimeType: item.original.mimeType,
    filename: item.original.filename,
    source: item.source.label,
    sourceUrl: item.officialUrl,
    released: item.datePublished,
    hasAlpha: item.original.hasAlpha,
  };
  if (item.video) {
    Object.assign(meta, {
      duration: item.video.duration,
      fps: item.video.fps,
      fpsSource: "metadata",
      frameCount: item.video.frameCount,
      videoCodec: item.video.videoCodec,
      audioCodec: item.video.audioCodec,
      bitrate: item.video.bitrate,
      sampleRate: item.video.audioSampleRate,
      channels: item.video.audioChannels,
    } satisfies MediaMeta);
  }
  if (item.audio) {
    Object.assign(meta, {
      duration: item.audio.duration,
      audioCodec: item.audio.codec,
      bitrate: item.audio.bitrate,
      sampleRate: item.audio.sampleRate,
      channels: item.audio.channels,
    } satisfies MediaMeta);
  }
  return {
    id: uid(),
    kind: item.kind,
    origin: "archive",
    src: item.original.url,
    title: item.title,
    slug: item.slug,
    item,
    poster,
    thumb: smallestVariant(item, 480)?.url,
    storyboard: item.storyboard,
    cors: true,
    meta,
  };
}

export function fromFile(file: File): ViewerMedia | null {
  const kind = kindFromName(file.name, file.type);
  if (!kind) return null;
  const url = URL.createObjectURL(file);
  return {
    id: uid(),
    kind,
    origin: "local",
    src: url,
    title: file.name,
    file,
    thumb: kind === "image" ? url : undefined,
    cors: true,
    meta: { bytes: file.size, mimeType: file.type || undefined, filename: file.name, lastModified: file.lastModified, source: "Local file" },
  };
}

export function fromUrl(raw: string): ViewerMedia | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "Only http(s) URLs can be opened." };
  const kind = kindFromName(url.pathname) ?? "image";
  const filename = decodeURIComponent(url.pathname.split("/").pop() || url.hostname);
  return {
    id: uid(),
    kind,
    origin: "url",
    src: url.toString(),
    title: filename,
    thumb: kind === "image" ? url.toString() : undefined,
    // Optimistic: the layer retries without CORS (and marks pixels unreadable) if this fails.
    cors: true,
    meta: { filename, source: url.hostname, sourceUrl: url.toString() },
  };
}

export function fromCapture(c: Capture): ViewerMedia {
  return {
    id: uid(),
    kind: "image",
    origin: "capture",
    src: c.url,
    title: c.title,
    thumb: c.url,
    cors: true,
    meta: { width: c.width, height: c.height, bytes: c.blob.size, mimeType: c.blob.type, filename: `${c.title}.png`, source: "Frame capture" },
  };
}

/** Read container metadata (codecs, exact fps) for local files and range-capable URLs. */
export async function probeContainer(m: ViewerMedia): Promise<Partial<MediaMeta>> {
  if (m.kind === "image") return {};
  try {
    const reader = m.file ? fileReader(m.file) : m.origin === "url" ? httpReader(m.src) : null;
    if (!reader) return {};
    const info = await readContainer(reader, m.meta.mimeType ?? m.file?.type ?? "", m.file?.size);
    const patch: Partial<MediaMeta> = {};
    if (info.videoCodec) patch.videoCodec = info.videoCodec;
    if (info.audioCodec) patch.audioCodec = info.audioCodec;
    if (info.fps) {
      patch.fps = info.fps;
      patch.fpsSource = "container";
    }
    if (info.frameCount) patch.frameCount = info.frameCount;
    if (info.sampleRate) patch.sampleRate = info.sampleRate;
    if (info.channels) patch.channels = info.channels;
    return patch;
  } catch {
    return {};
  }
}

/** Parse a timecode typed by the user: `12.5`, `1:02.5`, `00:01:02.500`, `00:01:02:15` (SMPTE), `f370`/`370f`. */
export function parseTimeInput(input: string, fps: number): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const frame = /^f\s*(\d+)$|^(\d+)\s*f$/.exec(s);
  if (frame) return (Number(frame[1] ?? frame[2]) + 0.5) / fps;
  const smpte = /^(\d+):(\d{1,2}):(\d{1,2})[:;](\d{1,3})$/.exec(s);
  if (smpte) return Number(smpte[1]) * 3600 + Number(smpte[2]) * 60 + Number(smpte[3]) + (Number(smpte[4]) + 0.5) / Math.round(fps);
  const parts = s.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
