#!/usr/bin/env node
/**
 * Imports the official trailers as streamed videos.
 *
 * The video files stay where they are hosted; nothing is downloaded in full.
 * ffmpeg reads each URL with range requests to probe the technical metadata
 * and to grab individual frames for the poster and the storyboard sprite
 * (scrubber previews).
 *
 * Output:
 *   public/media/<slug>/poster.jpg, w*.webp, storyboard.jpg
 *   data/generated/trailers.json   manifest read by lib/content
 *
 * Usage: node scripts/import-trailers.mjs [--force] [--only slug,slug]
 */
import { mkdir, writeFile, readFile, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_MEDIA = path.join(ROOT, "public", "media");
const MANIFEST_PATH = path.join(ROOT, "data", "generated", "trailers.json");
const VARIANT_WIDTHS = [480, 960, 1920];
const TILE_W = 192;
const TILE_H = 108;
const COLUMNS = 10;
const CONCURRENCY = 6;

/** Rockstar's CDN serves each video at several heights under one id. */
const rockstar = (id, height) => `https://videos-rockstargames-com.akamaized.net/v4/${id}/flv/en-us-${height}p.mp4`;

/**
 * `url` is the highest quality file (used by the Media Viewer); `renditions`
 * are smaller encodes of the same video for everyday playback.
 * `proxy`: the host sends no CORS headers, so the site streams the file
 * through /api/video/<slug> to keep frame capture and pixel tools working.
 */
const TRAILERS = [
  {
    slug: "gta-vi-trailer-1",
    url: "https://cdn.invincible25.com/GTAVI_Trailer1.mp4",
    proxy: true,
    posterAt: 14,
    interval: 2,
  },
  {
    slug: "gta-vi-trailer-2",
    url: rockstar("cpys7u2s", 2160),
    renditions: [1080, 720].map((h) => ({ height: h, url: rockstar("cpys7u2s", h) })),
    proxy: false,
    posterAt: 98,
    interval: 2,
  },
  {
    slug: "gta-vi-extended-look",
    url: rockstar("rk721912", 2160),
    renditions: [1080, 720].map((h) => ({ height: h, url: rockstar("rk721912", h) })),
    proxy: false,
    posterAt: 750,
    interval: 30,
  },
];

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = (() => {
  const i = args.indexOf("--only");
  return i >= 0 ? new Set(args[i + 1].split(",")) : null;
})();

const rel = (abs) => "/" + path.relative(path.join(ROOT, "public"), abs).split(path.sep).join("/");

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
}

/** `ffmpeg -i` with no output exits non-zero but prints the stream info. */
function probe(url) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-i", url], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", () => resolve(err));
  });
}

async function headBytes(url) {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`HEAD ${url} → ${res.status}`);
  return Number(res.headers.get("content-length")) || undefined;
}

const CODEC_NAMES = { av1: "AV1", h264: "H.264", hevc: "H.265 (HEVC)", vp9: "VP9" };

function parseProbe(text) {
  const d = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(text);
  const video = /Stream #\S+.*?Video: (\w+)(?: \(([^)]+)\))?.*?, (\d{2,5})x(\d{2,5}).*?, ([\d.]+) fps/.exec(text);
  const audio = /Stream #\S+.*?Audio: (\w+)(?: \(([^)]+)\))?.*?, (\d+) Hz, (mono|stereo|5\.1|7\.1)/.exec(text);
  const bitrate = /bitrate: (\d+) kb\/s/.exec(text);
  if (!d || !video) throw new Error("Could not read stream info:\n" + text.slice(-800));
  const duration = +d[1] * 3600 + +d[2] * 60 + +d[3];
  // Containers report e.g. 30.01 for 30 fps material; snap to the common rates.
  const raw = +video[5];
  const fps = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60].reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
  return {
    duration,
    width: +video[3],
    height: +video[4],
    fps,
    videoCodec: (CODEC_NAMES[video[1]] ?? video[1].toUpperCase()) + (video[2] ? ` (${video[2].split(" ")[0]})` : ""),
    audioCodec: audio ? (audio[1] === "aac" ? `AAC-${audio[2]?.split(" ")[0] ?? "LC"}` : audio[1].toUpperCase()) : undefined,
    audioSampleRate: audio ? +audio[3] : undefined,
    audioChannels: audio ? ({ mono: 1, stereo: 2, 5.1: 6, 7.1: 8 }[audio[4]] ?? 2) : undefined,
    bitrate: bitrate ? +bitrate[1] * 1000 : undefined,
  };
}

/** Seek with range requests and save one frame, scaled to `width`. */
const grab = (url, t, out, width, quality = 3) =>
  run(["-y", "-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", url, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", String(quality), out]);

async function pool(items, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function writeVariants(dir, input) {
  const variants = [];
  for (const vw of VARIANT_WIDTHS) {
    const out = path.join(dir, `w${vw}.webp`);
    const info = await sharp(input)
      .resize({ width: vw })
      .webp({ quality: vw <= 480 ? 72 : 80 })
      .toFile(out);
    variants.push({ width: info.width, height: info.height, url: rel(out), bytes: info.size, format: "webp" });
  }
  const blurBuf = await sharp(input).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(input).stats();
  const hex = "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { variants, blurDataUrl: `data:image/webp;base64,${blurBuf.toString("base64")}`, dominantColor: hex };
}

async function buildStoryboard(t, dir, duration) {
  const out = path.join(dir, "storyboard.jpg");
  const count = Math.floor(duration / t.interval) + 1;
  const rows = Math.ceil(count / COLUMNS);
  const meta = { url: rel(out), interval: t.interval, columns: COLUMNS, rows, tileWidth: TILE_W, tileHeight: TILE_H, count };
  if (existsSync(out) && !FORCE) return meta;
  const tmp = path.join(dir, ".tiles");
  await mkdir(tmp, { recursive: true });
  // The very last tile sits slightly before the end so a frame exists there.
  const times = Array.from({ length: count }, (_, i) => Math.min(i * t.interval, duration - 0.5));
  let done = 0;
  await pool(
    times.map((time, i) => ({ time, i })),
    async ({ time, i }) => {
      await grab(t.url, time, path.join(tmp, `${i}.jpg`), TILE_W, 5);
      process.stdout.write(`\r  storyboard ${++done}/${count}`);
    },
  );
  process.stdout.write("\n");
  const tiles = await Promise.all(
    times.map(async (_, i) => ({
      input: await sharp(path.join(tmp, `${i}.jpg`))
        .resize(TILE_W, TILE_H, { fit: "cover" })
        .toBuffer(),
      left: (i % COLUMNS) * TILE_W,
      top: Math.floor(i / COLUMNS) * TILE_H,
    })),
  );
  await sharp({ create: { width: COLUMNS * TILE_W, height: rows * TILE_H, channels: 3, background: "#000" } })
    .composite(tiles)
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(out);
  await rm(tmp, { recursive: true, force: true });
  return meta;
}

async function buildTrailer(t) {
  const dir = path.join(PUBLIC_MEDIA, t.slug);
  await mkdir(dir, { recursive: true });
  console.log(`→ ${t.slug}`);
  const info = parseProbe(await probe(t.url));
  const bytes = await headBytes(t.url);

  const posterFull = path.join(dir, "poster-full.jpg");
  await grab(t.url, t.posterAt, posterFull, info.width, 2);
  const poster = path.join(dir, "poster.jpg");
  const p = await sharp(posterFull).resize({ width: 1920 }).jpeg({ quality: 86, mozjpeg: true }).toFile(poster);
  const v = await writeVariants(dir, posterFull);
  await rm(posterFull, { force: true });

  const storyboard = await buildStoryboard(t, dir, info.duration);
  const renditions = await Promise.all(
    (t.renditions ?? []).map(async (r) => ({
      width: Math.round((r.height * info.width) / info.height),
      height: r.height,
      url: r.url,
      bytes: await headBytes(r.url),
    })),
  );
  return {
    kind: "video",
    url: t.url,
    proxy: t.proxy,
    original: {
      url: t.proxy ? `/api/video/${t.slug}` : t.url,
      width: info.width,
      height: info.height,
      bytes,
      mimeType: "video/mp4",
      filename: `${t.slug}.mp4`,
    },
    video: {
      duration: +info.duration.toFixed(3),
      fps: info.fps,
      frameCount: Math.round(info.duration * info.fps),
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
      audioChannels: info.audioChannels,
      audioSampleRate: info.audioSampleRate,
      bitrate: info.bitrate,
    },
    poster: { url: rel(poster), width: p.width, height: p.height, bytes: (await stat(poster)).size },
    variants: v.variants,
    blurDataUrl: v.blurDataUrl,
    dominantColor: v.dominantColor,
    storyboard,
    ...(renditions.length ? { renditions } : {}),
  };
}

async function main() {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(await readFile(MANIFEST_PATH, "utf8")) : {};
  for (const t of TRAILERS) {
    if (ONLY ? !ONLY.has(t.slug) : manifest[t.slug] && !FORCE) continue;
    manifest[t.slug] = await buildTrailer(t);
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(`Wrote ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
