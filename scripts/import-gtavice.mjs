#!/usr/bin/env node
/**
 * Imports official GTA VI images from the gtavice.net galleries.
 *
 * For every gallery: parses the full-resolution image links, downloads the
 * originals (resumable, limited concurrency), generates 480/960/1920 WebP
 * display variants, reads dimensions and dominant colour, and infers
 * character / location tags from the filenames.
 *
 * Output:
 *   public/media/gv/<slug>/original.<ext> + w*.webp
 *   data/generated/gtavice.json   (items + collections, consumed by lib/content)
 *
 * Usage: node scripts/import-gtavice.mjs [--only gallery-slug,...] [--limit N]
 */
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://www.gtavice.net";
const OUT_DIR = path.join(ROOT, "public", "media", "gv");
const OUT_JSON = path.join(ROOT, "data", "generated", "gtavice.json");
const UA = "Mozilla/5.0 (compatible; GTA6HubImporter/1.0; +https://gtasixhub.com)";
const CONCURRENCY = 5;
const WIDTHS = [480, 960, 1920];

const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

/** Gallery → collection metadata. Dates are official event dates where known. */
const GALLERIES = [
  { slug: "trailer-2-screencaps", title: "Trailer 2", category: "screenshots", source: "trailer-2", date: "2025-05-06", kind: "release" },
  { slug: "trailer-1-screencaps", title: "Trailer 1", category: "screenshots", source: "trailer-1", date: "2023-12-04", kind: "release" },
  { slug: "official-screenshots-may-6-2025", title: "Official Screenshots — May 2025", category: "screenshots", source: "rockstar-website", date: "2025-05-06", kind: "release" },
  { slug: "official-artwork-may-6-2025", title: "Official Artwork — May 2025", category: "artwork", source: "rockstar-website", date: "2025-05-06", kind: "release" },
  { slug: "an-extended-look-screencaps", title: "An Extended Look", category: "screenshots", source: "extended-look", date: "2026-08-27", kind: "release" },
  { slug: "official-cover-art-reveal", title: "Cover Art Reveal", category: "artwork", source: "rockstar-website", date: "2026-06-18", kind: "release" },
  { slug: "official-pre-order-artwork", title: "Pre-Order Artwork", category: "artwork", source: "rockstar-website", date: "2026-06-18", kind: "release" },
  { slug: "official-pre-order-screenshots", title: "Pre-Order Screenshots", category: "screenshots", source: "rockstar-website", date: "2026-06-18", kind: "release" },
  { slug: "netflix-announcement-aug-6-2026", title: "Netflix Announcement", category: "promotional", source: "rockstar-newswire", date: "2026-08-06", kind: "release" },
  { slug: "official-previews-screenshots-and-artwork", title: "Previews: Screenshots & Artwork", category: "screenshots", source: "press", date: null, kind: "curated" },
  { slug: "official-website-screengrabs", title: "Official Website Screengrabs", category: "promotional", source: "rockstar-website", date: null, kind: "curated" },
  { slug: "soundtrack-artwork", title: "Soundtrack Artwork", category: "artwork", source: "music", date: null, kind: "curated" },
  { slug: "official-merchandise", title: "Official Merchandise", category: "promotional", source: "rockstar-store", date: null, kind: "curated" },
];

const CHARACTERS = [
  ["jason-duval", /\bjason\b/],
  ["lucia-caminos", /\blucia\b/],
  ["cal-hampton", /\bcal-hampton\b|\bcal\b/],
  ["brian-heder", /\bbrian\b/],
  ["boobie-ike", /\bboobie\b/],
  ["dre-quan-priest", /\bdre-?quan\b|\bdrequan\b/],
  ["real-dimez", /\breal-dimez\b|\bdimez\b/],
  ["raul-bautista", /\braul\b/],
];
const LOCATIONS = [
  ["vice-city", /\bvice-city\b/],
  ["leonida-keys", /\bleonida-keys\b|\bkeys\b/],
  ["grassrivers", /\bgrassrivers\b/],
  ["port-gellhorn", /\bport-gellhorn\b|\bgellhorn\b/],
  ["ambrosia", /\bambrosia\b/],
  ["mount-kalaga", /\bmount-kalaga\b|\bkalaga\b/],
];

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseGallery(html) {
  const items = [];
  const re = /<a title="([^"]*)" href="(\/content\/images\/[^"?]+)(?:\?etag=([0-9a-f]+))?" data-id="\d+"/g;
  let m;
  while ((m = re.exec(html))) items.push({ title: decode(m[1]).trim(), path: m[2], etag: m[3] });
  const lead = html.match(/<p class="lead[^>]*>([\s\S]*?)<\/p>/);
  return { items, description: lead ? decode(lead[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()) : "" };
}

async function pool(list, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < list.length) {
      const idx = i++;
      await fn(list[idx], idx);
    }
  });
  await Promise.all(workers);
}

/** Stable slug; long names are shortened with a hash (Windows MAX_PATH limits native image libraries). */
function slugFor(file) {
  const base = file.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  if (base.length <= 44) return `gv-${base}`;
  let h = 0;
  for (const c of base) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return `gv-${base.slice(0, 36).replace(/-+$/, "")}-${h.toString(36).slice(0, 6)}`;
}

const etagDate =(etag) => (etag ? new Date(parseInt(etag, 16) * 1000).toISOString() : null);

async function processImage(g, it) {
  const file = it.path.split("/").pop();
  const ext = file.split(".").pop().toLowerCase();
  const base = file.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  const slug = slugFor(file);
  const dir = path.join(OUT_DIR, slug);
  await mkdir(dir, { recursive: true });
  const original = path.join(dir, `original.${ext}`);
  if (!existsSync(original)) {
    const res = await fetch(ORIGIN + it.path, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${it.path}`);
    await writeFile(original, Buffer.from(await res.arrayBuffer()));
  }
  const img = sharp(original);
  const meta = await img.metadata();
  const variants = [];
  for (const w of WIDTHS) {
    if (w >= meta.width && variants.length) continue;
    const vw = Math.min(w, meta.width);
    const out = path.join(dir, `w${vw}.webp`);
    if (!existsSync(out)) await sharp(original).resize({ width: vw }).webp({ quality: vw <= 480 ? 70 : 80 }).toFile(out);
    const vm = await sharp(out).metadata();
    variants.push({ url: `/media/gv/${slug}/w${vw}.webp`, width: vm.width, height: vm.height, bytes: (await stat(out)).size, format: "webp" });
  }
  const { dominant } = await sharp(original).resize(64).stats();
  const color = "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const bytes = (await stat(original)).size;
  const tokens = base.replace(/_/g, "-");
  const characters = CHARACTERS.filter(([, r]) => r.test(tokens)).map(([s]) => s);
  const locations = LOCATIONS.filter(([, r]) => r.test(tokens)).map(([s]) => s);
  const added = etagDate(it.etag) ?? new Date().toISOString();
  return {
    slug,
    title: it.title,
    category: g.category,
    source: g.source,
    datePublished: g.date ?? added.slice(0, 10),
    dateAdded: added,
    width: meta.width,
    height: meta.height,
    hasAlpha: Boolean(meta.hasAlpha),
    original: { url: `/media/gv/${slug}/original.${ext}`, bytes, mimeType: `image/${ext === "jpg" ? "jpeg" : ext}`, filename: file, width: meta.width, height: meta.height, hasAlpha: Boolean(meta.hasAlpha) },
    variants,
    dominantColor: meta.hasAlpha ? null : color,
    characters,
    locations,
    via: `${ORIGIN}/galleries/${g.slug}`,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const prev = existsSync(OUT_JSON) ? JSON.parse(await readFile(OUT_JSON, "utf8")) : { items: [], collections: [] };
  const itemsBySlug = new Map(prev.items.map((i) => [i.slug, i]));
  const collections = new Map(prev.collections.map((c) => [c.slug, c]));

  for (const g of GALLERIES) {
    if (only && !only.has(g.slug)) continue;
    const html = await fetchText(`${ORIGIN}/galleries/${g.slug}`);
    const { items, description } = parseGallery(html);
    const list = items.slice(0, limit);
    const slugs = [];
    let done = 0;
    process.stdout.write(`${g.slug}: ${list.length} images `);
    await pool(list, CONCURRENCY, async (it) => {
      try {
        const rec = await processImage(g, it);
        // An image can appear in several galleries: keep one record, remember every collection.
        const existing = itemsBySlug.get(rec.slug);
        itemsBySlug.set(rec.slug, existing ? { ...existing, ...rec, category: existing.category, source: existing.source, datePublished: existing.datePublished } : rec);
        slugs.push(rec.slug);
      } catch (e) {
        process.stdout.write(`\n  ! ${it.path}: ${e.message}\n`);
      }
      if (++done % 25 === 0) process.stdout.write(".");
    });
    // Preserve gallery order.
    const order = new Map(list.map((it, i) => [slugFor(it.path.split("/").pop()), i]));
    slugs.sort((a, b) => order.get(a) - order.get(b));
    collections.set(g.slug, { slug: g.slug, title: g.title, kind: g.kind, date: g.date, description, category: g.category, source: g.source, via: `${ORIGIN}/galleries/${g.slug}`, mediaSlugs: slugs });
    console.log(` ok (${slugs.length})`);
    await writeFile(OUT_JSON, JSON.stringify({ importedAt: new Date().toISOString(), items: [...itemsBySlug.values()], collections: [...collections.values()] }, null, 1));
  }
  console.log(`done: ${itemsBySlug.size} images, ${collections.size} collections`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
