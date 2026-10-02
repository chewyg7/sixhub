/**
 * Minimal ISO-BMFF (MP4/MOV) reader for technical metadata.
 *
 * Reads only box headers and the `moov` box — never the media data — so it
 * works on multi-gigabyte local files and on remote files via HTTP Range.
 * Extracts codecs, exact frame rate (from `stts` sample durations), frame
 * count and duration.
 */

export type RangeReader = (offset: number, length: number) => Promise<ArrayBuffer>;

export interface ContainerInfo {
  container: "mp4" | "webm" | "unknown";
  duration?: number;
  fps?: number;
  frameCount?: number;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
}

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"]);

const CODEC_NAMES: Record<string, string> = {
  avc1: "H.264 / AVC",
  avc3: "H.264 / AVC",
  hvc1: "H.265 / HEVC",
  hev1: "H.265 / HEVC",
  av01: "AV1",
  vp09: "VP9",
  vp08: "VP8",
  mp4v: "MPEG-4 Part 2",
  apcn: "Apple ProRes 422",
  apch: "Apple ProRes 422 HQ",
  apcs: "Apple ProRes 422 LT",
  ap4h: "Apple ProRes 4444",
  mp4a: "AAC",
  "ac-3": "Dolby Digital (AC-3)",
  "ec-3": "Dolby Digital Plus (E-AC-3)",
  Opus: "Opus",
  fLaC: "FLAC",
  alac: "Apple Lossless",
  lpcm: "PCM",
  sowt: "PCM",
  twos: "PCM",
};

const AVC_PROFILES: Record<number, string> = { 66: "Baseline", 77: "Main", 88: "Extended", 100: "High", 110: "High 10", 122: "High 4:2:2", 244: "High 4:4:4" };

function fourcc(v: DataView, o: number) {
  return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
}

interface Track {
  handler?: string;
  timescale?: number;
  mediaDuration?: number;
  codec?: string;
  sampleCount?: number;
  totalDelta?: number;
  /** Sample duration shared by most frames (ignores odd first/last entries). */
  dominantDelta?: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
}

function walk(v: DataView, start: number, end: number, track: Track | null, tracks: Track[], movie: { timescale?: number; duration?: number }) {
  let o = start;
  while (o + 8 <= end) {
    let size = v.getUint32(o);
    const type = fourcc(v, o + 4);
    let header = 8;
    if (size === 1) {
      size = Number(v.getBigUint64(o + 8));
      header = 16;
    } else if (size === 0) size = end - o;
    if (size < header || o + size > end) break;
    const body = o + header;
    if (type === "trak") {
      const t: Track = {};
      tracks.push(t);
      walk(v, body, o + size, t, tracks, movie);
    } else if (CONTAINERS.has(type)) {
      walk(v, body, o + size, track, tracks, movie);
    } else if (type === "mvhd") {
      const ver = v.getUint8(body);
      movie.timescale = v.getUint32(body + (ver === 1 ? 20 : 12));
      movie.duration = ver === 1 ? Number(v.getBigUint64(body + 24)) : v.getUint32(body + 16);
    } else if (track && type === "mdhd") {
      const ver = v.getUint8(body);
      track.timescale = v.getUint32(body + (ver === 1 ? 20 : 12));
      track.mediaDuration = ver === 1 ? Number(v.getBigUint64(body + 24)) : v.getUint32(body + 16);
    } else if (track && type === "hdlr") {
      track.handler = fourcc(v, body + 8);
    } else if (track && type === "stsd") {
      const entry = body + 8;
      const codec = fourcc(v, entry + 4);
      track.codec = codec;
      if (track.handler === "vide") {
        track.width = v.getUint16(entry + 32);
        track.height = v.getUint16(entry + 34);
        // avcC lives inside the sample entry, after the 78-byte visual sample entry header.
        if (codec === "avc1" || codec === "avc3") {
          const inner = entry + 86;
          const entryEnd = entry + v.getUint32(entry);
          for (let p = inner; p + 8 < Math.min(entryEnd, end);) {
            const s = v.getUint32(p);
            if (fourcc(v, p + 4) === "avcC") {
              const profile = v.getUint8(p + 9);
              const level = v.getUint8(p + 11);
              track.codec = `avc1:${AVC_PROFILES[profile] ?? profile}:${(level / 10).toFixed(1)}`;
              break;
            }
            if (s < 8) break;
            p += s;
          }
        }
      } else if (track.handler === "soun") {
        track.channels = v.getUint16(entry + 24);
        track.sampleRate = v.getUint32(entry + 32) >>> 16;
      }
    } else if (track && type === "stts") {
      const n = v.getUint32(body + 4);
      let count = 0;
      let total = 0;
      let best = 0;
      for (let i = 0; i < n && body + 8 + i * 8 + 8 <= end; i++) {
        const c = v.getUint32(body + 8 + i * 8);
        const d = v.getUint32(body + 12 + i * 8);
        count += c;
        total += c * d;
        if (c > best) {
          best = c;
          track.dominantDelta = d;
        }
      }
      track.sampleCount = count;
      track.totalDelta = total;
    }
    o += size;
  }
}

function codecLabel(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("avc1:")) {
    const [, profile, level] = raw.split(":");
    return `H.264 / AVC (${profile}@L${level})`;
  }
  return CODEC_NAMES[raw] ?? raw;
}

/** Snap measured rates to broadcast values (23.976, 29.97, 59.94 …) when very close. */
export function snapFps(fps: number, tolerance = 0.0005): number {
  const common = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 119.88, 120, 144, 240];
  let best = fps;
  let bestDiff = Infinity;
  for (const c of common) {
    const diff = Math.abs(fps - c) / c;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return bestDiff < tolerance ? best : Math.round(fps * 1000) / 1000;
}

export async function readMp4(read: RangeReader, totalSize?: number): Promise<ContainerInfo> {
  let offset = 0;
  // Find `moov` by walking top-level box headers (it may be at the end of the file).
  for (let i = 0; i < 64; i++) {
    if (totalSize !== undefined && offset >= totalSize) break;
    const head = new DataView(await read(offset, 16));
    if (head.byteLength < 8) break;
    let size = head.getUint32(0);
    const type = fourcc(head, 4);
    if (i === 0 && type !== "ftyp" && type !== "moov" && type !== "wide" && type !== "mdat" && type !== "free") return { container: "unknown" };
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0 && totalSize) size = totalSize - offset;
    if (type === "moov") {
      if (size > 64 * 1024 * 1024) break;
      const buf = new DataView(await read(offset, size));
      const tracks: Track[] = [];
      const movie: { timescale?: number; duration?: number } = {};
      walk(buf, 8, buf.byteLength, null, tracks, movie);
      const vt = tracks.find((t) => t.handler === "vide");
      const at = tracks.find((t) => t.handler === "soun");
      const info: ContainerInfo = { container: "mp4" };
      if (movie.timescale && movie.duration) info.duration = movie.duration / movie.timescale;
      if (vt) {
        info.videoCodec = codecLabel(vt.codec);
        info.width = vt.width;
        info.height = vt.height;
        if (vt.sampleCount && vt.totalDelta && vt.timescale) {
          info.frameCount = vt.sampleCount;
          info.fps = snapFps(vt.dominantDelta ? vt.timescale / vt.dominantDelta : (vt.sampleCount * vt.timescale) / vt.totalDelta);
        }
      }
      if (at) {
        info.audioCodec = codecLabel(at.codec);
        info.sampleRate = at.sampleRate;
        info.channels = at.channels;
      }
      return info;
    }
    if (size < 8) break;
    offset += size;
  }
  return { container: "mp4" };
}

export function fileReader(file: Blob): RangeReader {
  return (offset, length) => file.slice(offset, offset + length).arrayBuffer();
}

/** Range reader over HTTP. Throws if the server ignores Range or blocks CORS. */
export function httpReader(url: string): RangeReader {
  return async (offset, length) => {
    const res = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
    if (res.status !== 206 && !(res.ok && offset === 0)) throw new Error(`Range request failed (${res.status})`);
    const buf = await res.arrayBuffer();
    return res.status === 206 ? buf : buf.slice(offset, offset + length);
  };
}

/** WebM/Matroska: sniff codec IDs from the header (no full EBML parse needed). */
export async function readWebm(read: RangeReader): Promise<ContainerInfo> {
  const head = new Uint8Array(await read(0, 64 * 1024));
  const text = new TextDecoder("latin1").decode(head);
  const find = (ids: [string, string][]) => ids.find(([id]) => text.includes(id))?.[1];
  return {
    container: "webm",
    videoCodec: find([
      ["V_VP9", "VP9"],
      ["V_VP8", "VP8"],
      ["V_AV1", "AV1"],
      ["V_MPEG4/ISO/AVC", "H.264 / AVC"],
      ["V_MPEGH/ISO/HEVC", "H.265 / HEVC"],
    ]),
    audioCodec: find([
      ["A_OPUS", "Opus"],
      ["A_VORBIS", "Vorbis"],
      ["A_AAC", "AAC"],
      ["A_FLAC", "FLAC"],
    ]),
  };
}

export async function readContainer(read: RangeReader, mime: string, size?: number): Promise<ContainerInfo> {
  const sig = new Uint8Array(await read(0, 12));
  if (sig[0] === 0x1a && sig[1] === 0x45 && sig[2] === 0xdf && sig[3] === 0xa3) return readWebm(read);
  if (String.fromCharCode(...sig.slice(4, 8)) === "ftyp" || /mp4|quicktime|m4v/.test(mime)) return readMp4(read, size);
  return { container: "unknown" };
}
