import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readdir, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

/**
 * Uploads in pieces. Cloudflare (free plan) refuses request bodies over
 * 100 MB, so the admin panel sends big files as a series of chunks: each one
 * lands in its own temp file (a retried chunk simply replaces itself), and
 * the upload request then stitches them together and checks nothing is
 * missing before the file is processed like any other upload.
 */

/** Largest chunk accepted; the uploader sends 48 MB. */
export const MAX_CHUNK = 64 * 1024 * 1024;
const DIR = tmpdir();
const ID = /^[a-f0-9]{32}$/;
/** Chunks of abandoned uploads are cleared after a day. */
const STALE_MS = 24 * 60 * 60 * 1000;

/** Chunk files are namespaced by user, so nobody can finish someone else's upload. */
const owner = (userId: string) => createHash("sha256").update(userId).digest("hex").slice(0, 16);
const prefix = (userId: string, id: string) => `gh-chunk-${owner(userId)}-${id}-`;

export function checkUploadId(id: string | null): string {
  if (!id || !ID.test(id)) throw new Error("Bad upload id.");
  return id;
}

/** Saves one chunk (the request body) at `offset`. */
export async function saveChunk(body: ReadableStream<Uint8Array>, userId: string, id: string, offset: number, maxTotal: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= maxTotal) throw new Error("Bad chunk offset.");
  const final = path.join(DIR, `${prefix(userId, id)}${String(offset).padStart(13, "0")}`);
  const part = `${final}.${randomBytes(4).toString("hex")}.part`;
  const out = createWriteStream(part, { mode: 0o600 });
  let size = 0;
  try {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > MAX_CHUNK || offset + size > maxTotal) throw new Error("That file is too large.");
      if (!out.write(chunk)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    if (!size) throw new Error("Empty chunk.");
    // Only a complete chunk takes the real name.
    await rename(part, final);
    return size;
  } catch (e) {
    out.destroy();
    await rm(part, { force: true });
    throw e;
  }
}

/** Joins an upload's chunks into one temp file, checking they run back to back from the start. */
export async function assemble(userId: string, id: string, maxTotal: number): Promise<{ file: string; size: number }> {
  const pre = prefix(userId, id);
  const names = (await readdir(DIR)).filter((n) => n.startsWith(pre) && !n.endsWith(".part")).sort();
  if (!names.length) throw new Error("That upload didn’t arrive. Try again.");
  const parts = await Promise.all(names.map(async (n) => ({ file: path.join(DIR, n), offset: Number(n.slice(pre.length)), size: (await stat(path.join(DIR, n))).size })));
  let expected = 0;
  for (const p of parts) {
    if (p.offset !== expected) throw new Error("Part of that upload is missing. Try again.");
    expected += p.size;
  }
  if (expected > maxTotal) throw new Error("That file is too large.");
  const file = path.join(DIR, `gh-upload-${randomBytes(8).toString("hex")}`);
  try {
    const out = createWriteStream(file, { mode: 0o600 });
    for (const p of parts) await pipeline(createReadStream(p.file), out, { end: false });
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch (e) {
    await rm(file, { force: true });
    throw e;
  } finally {
    await Promise.all(parts.map((p) => rm(p.file, { force: true })));
  }
  return { file, size: expected };
}

/** Removes chunks left behind by uploads that never finished. */
export async function sweepChunks() {
  const now = Date.now();
  for (const n of await readdir(DIR).catch(() => [] as string[])) {
    if (!n.startsWith("gh-chunk-")) continue;
    const f = path.join(DIR, n);
    const s = await stat(f).catch(() => null);
    if (s && now - s.mtimeMs > STALE_MS) await rm(f, { force: true });
  }
}
