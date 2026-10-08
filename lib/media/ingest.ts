import "server-only";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile, copyFile, stat, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import * as opentype from "opentype.js";
import { UPLOAD_DIR } from "@/lib/db";
import type { AudioTechnical, FontTechnical, ImageVariant, MediaFile, Storyboard, VideoTechnical } from "@/types/content";
import type { Sniffed } from "./sniff";

/**
 * Turns a verified upload into archive files: the original plus WebP display
 * variants, a blur placeholder and dominant colour; for videos a poster frame
 * and storyboard sprite; for fonts a specimen image drawn from the font.
 * Work happens in the OS temp directory; results are copied into
 * `<UPLOAD_DIR>/media/<dir>/` and served from `/files/media/<dir>/…`.
 */
export interface Ingested {
  kind: Sniffed["kind"];
  width?: number;
  height?: number;
  original: MediaFile;
  variants: ImageVariant[];
  poster?: MediaFile;
  blurDataUrl?: string;
  dominantColor: string | null;
  video?: VideoTechnical;
  audio?: AudioTechnical;
  font?: FontTechnical;
  storyboard?: Storyboard;
}

const VARIANT_WIDTHS = [480, 960, 1920];
sharp.cache(false);
// Refuse decompression bombs: nothing above 120 megapixels.
const PIXEL_LIMIT = 120_000_000;

export const publicUrl = (dir: string, file: string) => `/files/media/${dir}/${file}`;

function ff(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath as unknown as string, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg failed: ${err.slice(-300)}`))));
  });
}

/** `ffmpeg -i` prints stream info and exits non-zero without an output. */
export function probe(input: string, extra: string[] = []): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath as unknown as string, ["-hide_banner", ...extra, "-i", input], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", () => resolve(err));
    p.on("close", () => resolve(err));
  });
}

const CODEC_NAMES: Record<string, string> = { av1: "AV1", h264: "H.264", hevc: "H.265 (HEVC)", vp9: "VP9", vp8: "VP8", prores: "ProRes" };

export function parseProbe(text: string) {
  const d = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(text);
  const video = /Stream #\S+.*?Video: (\w+)(?: \(([^)]+)\))?.*?, (\d{2,5})x(\d{2,5}).*?, ([\d.]+) fps/.exec(text);
  const audio = /Stream #\S+.*?Audio: (\w+)(?: \(([^)]+)\))?.*?, (\d+) Hz, (mono|stereo|5\.1|7\.1)/.exec(text);
  const bitrate = /bitrate: (\d+) kb\/s/.exec(text);
  const duration = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0;
  const raw = video ? +video[5] : 0;
  const fps = raw ? [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60].reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a)) : 0;
  return {
    duration,
    width: video ? +video[3] : undefined,
    height: video ? +video[4] : undefined,
    fps,
    videoCodec: video ? (CODEC_NAMES[video[1]] ?? video[1].toUpperCase()) + (video[2] ? ` (${video[2].split(" ")[0]})` : "") : undefined,
    audioCodec: audio ? (audio[1] === "aac" ? `AAC-${audio[2]?.split(" ")[0] ?? "LC"}` : audio[1].toUpperCase()) : undefined,
    audioSampleRate: audio ? +audio[3] : undefined,
    audioChannels: audio ? ({ mono: 1, stereo: 2, "5.1": 6, "7.1": 8 } as Record<string, number>)[audio[4]] : undefined,
    bitrate: bitrate ? +bitrate[1] * 1000 : undefined,
  };
}

/** Display variants, blur placeholder and dominant colour for an image buffer. */
export async function imageVariants(input: Buffer, outDir: string, dir: string, opts: { alpha: boolean }) {
  const meta = await sharp(input, { limitInputPixels: PIXEL_LIMIT }).metadata();
  const width = meta.width ?? 0;
  const widths = VARIANT_WIDTHS.filter((w) => w < width).concat(width <= 1920 ? [width] : []);
  const variants: ImageVariant[] = [];
  for (const vw of [...new Set(widths)]) {
    const { data, info } = await sharp(input, { limitInputPixels: PIXEL_LIMIT })
      .rotate()
      .resize({ width: vw })
      .webp({ quality: vw <= 480 ? 74 : 82, alphaQuality: 92 })
      .toBuffer({ resolveWithObject: true });
    const file = `w${vw}.webp`;
    await writeFile(path.join(outDir, file), data);
    variants.push({ width: info.width, height: info.height, url: publicUrl(dir, file), bytes: info.size, format: "webp" });
  }
  const blur = await sharp(input, { limitInputPixels: PIXEL_LIMIT }).rotate().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(input, { limitInputPixels: PIXEL_LIMIT }).resize(64).stats();
  const hex = "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { variants, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`, dominantColor: opts.alpha ? null : hex, width, height: meta.height ?? 0 };
}

/** A specimen image drawn from a font's own outlines (glyph by glyph; see scripts/import-brand-assets.mjs). */
function specimenSvg(font: opentype.Font, name: string) {
  const W = 1920;
  const H = 1080;
  const text = (s: string, x: number, y: number, size: number, fill: string) => {
    const scale = size / font.unitsPerEm;
    let cursor = x;
    let d = "";
    for (const ch of s) {
      const g = font.charToGlyph(ch);
      d += g.getPath(cursor, y, size).toPathData(2);
      cursor += (g.advanceWidth ?? 0) * scale;
    }
    return `<path d="${d}" fill="${fill}"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1630"/><stop offset="1" stop-color="#120c18"/></linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e445b8"/><stop offset=".5" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ff8a73"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${text("Aa", 120, 560, 460, "url(#s)")}
    ${text("Welcome to Leonida", 120, 760, 104, "#f8f0f6")}
    ${text("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 120, 880, 58, "rgba(248,240,246,0.62)")}
    ${text("abcdefghijklmnopqrstuvwxyz 0123456789", 120, 960, 58, "rgba(248,240,246,0.62)")}
    ${text(name.slice(0, 40), 1080, 210, 64, "rgba(248,240,246,0.85)")}
  </svg>`;
}

/** A plain branded cover for audio and fonts that can't be drawn. */
function coverSvg(label: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e445b8"/><stop offset=".55" stop-color="#7b3fa8"/><stop offset="1" stop-color="#1a1230"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/><circle cx="960" cy="540" r="190" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="18"/><text x="960" y="840" font-family="sans-serif" font-size="64" text-anchor="middle" fill="rgba(255,255,255,0.85)">${label}</text></svg>`;
}

/**
 * Processes `tmpFile` (already verified by sniff) and copies the results to
 * `<UPLOAD_DIR>/media/<dir>/`. The temp file is left for the caller to delete.
 */
export async function ingestFile(tmpFile: string, sniffed: Sniffed, dir: string, originalName: string): Promise<Ingested> {
  const outDir = path.join(UPLOAD_DIR, "media", dir);
  await mkdir(outDir, { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), "gh-ingest-"));
  const bytes = (await stat(tmpFile)).size;
  const safeName = originalName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || `file.${sniffed.ext}`;
  const originalFile = `original.${sniffed.ext}`;
  await copyFile(tmpFile, path.join(outDir, originalFile));
  const original: MediaFile = { url: publicUrl(dir, originalFile), mimeType: sniffed.mime, filename: safeName, bytes };

  try {
    if (sniffed.kind === "image") {
      const buf = await readFile(tmpFile);
      const meta = await sharp(buf, { limitInputPixels: PIXEL_LIMIT }).metadata();
      const alpha = !!meta.hasAlpha;
      const v = await imageVariants(buf, outDir, dir, { alpha });
      return { kind: "image", width: v.width, height: v.height, original: { ...original, width: v.width, height: v.height, hasAlpha: alpha }, variants: v.variants, blurDataUrl: v.blurDataUrl, dominantColor: v.dominantColor };
    }

    if (sniffed.kind === "video") {
      const info = parseProbe(await probe(tmpFile));
      if (!info.duration || !info.width) throw new Error("That video couldn't be read.");
      const posterTmp = path.join(work, "poster.jpg");
      await ff(["-y", "-hide_banner", "-loglevel", "error", "-ss", (info.duration * 0.1).toFixed(2), "-i", tmpFile, "-frames:v", "1", "-q:v", "2", posterTmp]);
      const posterBuf = await sharp(await readFile(posterTmp)).resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      await writeFile(path.join(outDir, "poster.jpg"), posterBuf.data);
      const v = await imageVariants(posterBuf.data, outDir, dir, { alpha: false });
      // Storyboard: one 192×108 tile every `interval` seconds, 10 per row.
      const interval = Math.max(1, Math.ceil(info.duration / 120));
      const count = Math.floor(info.duration / interval) + 1;
      const rows = Math.ceil(count / 10);
      const sbTmp = path.join(work, "storyboard.jpg");
      await ff(["-y", "-hide_banner", "-loglevel", "error", "-i", tmpFile, "-vf", `fps=1/${interval},scale=192:108:force_original_aspect_ratio=increase,crop=192:108,tile=10x${rows}`, "-frames:v", "1", "-q:v", "5", sbTmp]);
      await copyFile(sbTmp, path.join(outDir, "storyboard.jpg"));
      return {
        kind: "video",
        width: info.width,
        height: info.height,
        original: { ...original, width: info.width, height: info.height },
        variants: v.variants,
        poster: { url: publicUrl(dir, "poster.jpg"), width: posterBuf.info.width, height: posterBuf.info.height, bytes: posterBuf.info.size, mimeType: "image/jpeg", filename: "poster.jpg" },
        blurDataUrl: v.blurDataUrl,
        dominantColor: v.dominantColor,
        video: {
          duration: +info.duration.toFixed(3),
          fps: info.fps || 30,
          frameCount: Math.round(info.duration * (info.fps || 30)),
          videoCodec: info.videoCodec,
          audioCodec: info.audioCodec,
          audioChannels: info.audioChannels,
          audioSampleRate: info.audioSampleRate,
          bitrate: info.bitrate,
        },
        storyboard: { url: publicUrl(dir, "storyboard.jpg"), interval, columns: 10, rows, tileWidth: 192, tileHeight: 108, count },
      };
    }

    if (sniffed.kind === "audio") {
      const info = parseProbe(await probe(tmpFile));
      if (!info.duration) throw new Error("That audio file couldn't be read.");
      const cover = await sharp(Buffer.from(coverSvg("Audio"))).png().toBuffer();
      await writeFile(path.join(outDir, "cover.png"), cover);
      const v = await imageVariants(cover, outDir, dir, { alpha: false });
      return {
        kind: "audio",
        original,
        variants: v.variants,
        poster: { url: publicUrl(dir, "cover.png"), width: 1920, height: 1080, mimeType: "image/png", filename: "cover.png" },
        blurDataUrl: v.blurDataUrl,
        dominantColor: v.dominantColor,
        audio: { duration: +info.duration.toFixed(3), codec: info.audioCodec, bitrate: info.bitrate, sampleRate: info.audioSampleRate, channels: info.audioChannels },
      };
    }

    // Fonts
    const buf = await readFile(tmpFile);
    let font: FontTechnical = { family: path.parse(safeName).name, style: "Regular", format: sniffed.ext.toUpperCase() };
    let specimen: Buffer;
    try {
      // opentype.js reads TTF/OTF/WOFF; WOFF2 gets a plain cover.
      if (sniffed.ext === "woff2") throw new Error("woff2");
      const parsed = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
      font = {
        family: parsed.names.fontFamily?.en ?? font.family,
        style: parsed.names.fontSubfamily?.en ?? font.style,
        glyphs: parsed.glyphs.length,
        format: { ttf: "TrueType", otf: "OpenType", woff: "WOFF", woff2: "WOFF2" }[sniffed.ext],
      };
      specimen = await sharp(Buffer.from(specimenSvg(parsed, parsed.names.fullName?.en ?? font.family))).png().toBuffer();
    } catch {
      specimen = await sharp(Buffer.from(coverSvg(font.family.replace(/[<>&"]/g, "")))).png().toBuffer();
    }
    await writeFile(path.join(outDir, "specimen.png"), specimen);
    const v = await imageVariants(specimen, outDir, dir, { alpha: false });
    return {
      kind: "font",
      width: 1920,
      height: 1080,
      original,
      variants: v.variants,
      poster: { url: publicUrl(dir, "specimen.png"), width: 1920, height: 1080, mimeType: "image/png", filename: "specimen.png" },
      blurDataUrl: v.blurDataUrl,
      dominantColor: v.dominantColor,
      font,
    };
  } catch (e) {
    await rm(outDir, { recursive: true, force: true });
    throw e;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Deletes an uploaded item's files (only ever inside UPLOAD_DIR/media). */
export async function removeUploadedFiles(urls: string[]) {
  const dirs = new Set(urls.filter((u) => u.startsWith("/files/media/")).map((u) => u.split("/")[3]));
  for (const d of dirs) {
    if (!/^[a-z0-9-]+$/.test(d)) continue;
    await rm(path.join(UPLOAD_DIR, "media", d), { recursive: true, force: true });
  }
}
