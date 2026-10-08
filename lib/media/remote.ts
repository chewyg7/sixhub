import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { UPLOAD_DIR } from "@/lib/db";
import { mediaSlugExists, upsertMedia } from "@/lib/db/content";
import { uniqueSlug } from "@/lib/slug";
import { imageVariants, parseProbe, probe, publicUrl } from "./ingest";

/**
 * Remote files are fetched by the server, so every URL is checked first:
 * https only, standard port, and every address the host resolves to must be
 * public — never loopback, private, link-local or cloud metadata ranges.
 * This stops the admin panel being used to probe the server's network.
 */
function isPrivate(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff") || (v6.startsWith("::ffff:") && isPrivate(v6.slice(7)));
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("Only https:// links are allowed.");
  if (u.port && u.port !== "443") throw new Error("Only the standard https port is allowed.");
  if (u.username || u.password) throw new Error("Links can't contain credentials.");
  const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("That host couldn't be found.");
  if (addrs.some((a) => isPrivate(a.address))) throw new Error("That address isn't allowed.");
  return u;
}

/** ffmpeg limited to https, so redirects can't hop to plain http or local files. */
const SAFE_PROTOCOLS = ["-protocol_whitelist", "https,tls,tcp,crypto"];

function grab(url: string, at: number, out: string, width: number) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath as unknown as string, ["-y", "-hide_banner", "-loglevel", "error", ...SAFE_PROTOCOLS, "-ss", at.toFixed(2), "-i", url, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3", out], { windowsHide: true });
    const timer = setTimeout(() => p.kill("SIGKILL"), 60_000);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error("Couldn't read a frame from that video."));
    });
  });
}

async function headBytes(url: string) {
  const r = await fetch(url, { method: "HEAD", redirect: "follow" }).catch(() => null);
  return Number(r?.headers.get("content-length")) || undefined;
}

export async function importRemoteVideo(f: { url: string; title: string; folderId: string; category: string; sourceSlug: string; datePublished: string; renditions: string[] }, createdBy: string): Promise<string> {
  await assertPublicUrl(f.url);
  for (const r of f.renditions) await assertPublicUrl(r);
  const info = parseProbe(await probe(f.url, SAFE_PROTOCOLS));
  if (!info.duration || !info.width || !info.height) throw new Error("That link didn't return a playable video.");

  const slug = uniqueSlug(f.title, mediaSlugExists);
  const dir = `${slug}-${randomBytes(3).toString("hex")}`;
  const outDir = path.join(UPLOAD_DIR, "media", dir);
  await mkdir(outDir, { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), "gh-remote-"));
  try {
    const posterTmp = path.join(work, "poster.jpg");
    await grab(f.url, Math.min(info.duration * 0.15, 120), posterTmp, 1920);
    const posterBuf = await readFile(posterTmp);
    await writeFile(path.join(outDir, "poster.jpg"), posterBuf);
    const v = await imageVariants(posterBuf, outDir, dir, { alpha: false });

    // Storyboard from individual seeks (never downloads the whole file).
    const interval = Math.max(2, Math.ceil(info.duration / 60));
    const count = Math.floor(info.duration / interval) + 1;
    const tiles: { input: Buffer; left: number; top: number }[] = [];
    for (let i = 0; i < count; i++) {
      const out = path.join(work, `t${i}.jpg`);
      await grab(f.url, Math.min(i * interval, info.duration - 0.5), out, 192).catch(() => undefined);
      const buf = await readFile(out).catch(() => null);
      if (buf) tiles.push({ input: await sharp(buf).resize(192, 108, { fit: "cover" }).toBuffer(), left: (i % 10) * 192, top: Math.floor(i / 10) * 108 });
    }
    const rows = Math.ceil(count / 10);
    const sb = await sharp({ create: { width: 1920, height: rows * 108, channels: 3, background: "#000" } })
      .composite(tiles)
      .jpeg({ quality: 72 })
      .toBuffer();
    await writeFile(path.join(outDir, "storyboard.jpg"), sb);

    const renditions = await Promise.all(
      f.renditions.map(async (url) => {
        const r = parseProbe(await probe(url, SAFE_PROTOCOLS));
        return { url, width: r.width ?? 0, height: r.height ?? 0, bytes: await headBytes(url) };
      }),
    );
    upsertMedia(
      {
        id: slug,
        slug,
        title: f.title,
        kind: "video",
        category: f.category,
        folderId: f.folderId,
        description: `${f.title}.`,
        alt: f.title,
        datePublished: f.datePublished,
        dateAdded: new Date().toISOString(),
        sourceSlug: f.sourceSlug,
        width: info.width,
        height: info.height,
        original: { url: f.url, width: info.width, height: info.height, bytes: await headBytes(f.url), mimeType: "video/mp4", filename: `${slug}.mp4` },
        variants: v.variants,
        poster: { url: publicUrl(dir, "poster.jpg"), width: v.width, height: v.height, mimeType: "image/jpeg", filename: "poster.jpg" },
        blurDataUrl: v.blurDataUrl,
        dominantColor: v.dominantColor,
        video: { duration: +info.duration.toFixed(3), fps: info.fps || 30, frameCount: Math.round(info.duration * (info.fps || 30)), videoCodec: info.videoCodec, audioCodec: info.audioCodec, audioChannels: info.audioChannels, audioSampleRate: info.audioSampleRate, bitrate: info.bitrate },
        storyboard: { url: publicUrl(dir, "storyboard.jpg"), interval, columns: 10, rows, tileWidth: 192, tileHeight: 108, count },
        renditions: renditions.filter((r) => r.height).sort((a, b) => b.height - a.height),
        tags: [],
        characters: [],
        locations: [],
        downloadable: false,
        verification: "official",
      },
      { createdBy, status: "published", originKey: `remote:${f.url}` },
    );
    return slug;
  } catch (e) {
    await rm(outDir, { recursive: true, force: true });
    throw e;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
