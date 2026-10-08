import "server-only";

/**
 * Identifies a file from its first bytes. Uploads are trusted only if their
 * content matches one of these signatures; the file name and the browser's
 * claimed type are ignored. SVG, HTML and anything scriptable never match.
 */
export type Sniffed =
  | { kind: "image"; ext: "jpg" | "png" | "webp" | "gif" | "avif"; mime: string }
  | { kind: "video"; ext: "mp4" | "mov" | "webm"; mime: string }
  | { kind: "audio"; ext: "mp3" | "m4a" | "wav" | "ogg" | "flac"; mime: string }
  | { kind: "font"; ext: "ttf" | "otf" | "woff" | "woff2"; mime: string };

const ascii = (b: Buffer, start: number, len: number) => b.subarray(start, start + len).toString("latin1");

export function sniff(head: Buffer): Sniffed | null {
  if (head.length < 12) return null;
  // Images
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: "image", ext: "jpg", mime: "image/jpeg" };
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "image", ext: "png", mime: "image/png" };
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return { kind: "image", ext: "webp", mime: "image/webp" };
  if (ascii(head, 0, 6) === "GIF87a" || ascii(head, 0, 6) === "GIF89a") return { kind: "image", ext: "gif", mime: "image/gif" };
  // ISO base media (MP4 / MOV / M4A / AVIF): "ftyp" at offset 4, brand after it.
  if (ascii(head, 4, 4) === "ftyp") {
    const brand = ascii(head, 8, 4);
    if (brand === "avif" || brand === "avis") return { kind: "image", ext: "avif", mime: "image/avif" };
    if (brand === "M4A " || brand === "M4B ") return { kind: "audio", ext: "m4a", mime: "audio/mp4" };
    if (brand === "qt  ") return { kind: "video", ext: "mov", mime: "video/quicktime" };
    if (/^(isom|iso[2-9]|mp41|mp42|avc1|M4V |MSNV|dash|3gp\d|mmp4)/.test(brand)) return { kind: "video", ext: "mp4", mime: "video/mp4" };
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { kind: "video", ext: "webm", mime: "video/webm" };
  // Audio
  if (ascii(head, 0, 3) === "ID3" || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return { kind: "audio", ext: "mp3", mime: "audio/mpeg" };
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WAVE") return { kind: "audio", ext: "wav", mime: "audio/wav" };
  if (ascii(head, 0, 4) === "OggS") return { kind: "audio", ext: "ogg", mime: "audio/ogg" };
  if (ascii(head, 0, 4) === "fLaC") return { kind: "audio", ext: "flac", mime: "audio/flac" };
  // Fonts
  if (head.readUInt32BE(0) === 0x00010000 || ascii(head, 0, 4) === "true") return { kind: "font", ext: "ttf", mime: "font/ttf" };
  if (ascii(head, 0, 4) === "OTTO") return { kind: "font", ext: "otf", mime: "font/otf" };
  if (ascii(head, 0, 4) === "wOFF") return { kind: "font", ext: "woff", mime: "font/woff" };
  if (ascii(head, 0, 4) === "wOF2") return { kind: "font", ext: "woff2", mime: "font/woff2" };
  return null;
}

/** Upload size limits by kind (bytes). */
export const MAX_BYTES: Record<Sniffed["kind"], number> = {
  image: 80 * 1024 * 1024,
  video: 6 * 1024 * 1024 * 1024,
  audio: 600 * 1024 * 1024,
  font: 25 * 1024 * 1024,
};

/** Content types the /files route will serve, by extension. */
export const SERVE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};
