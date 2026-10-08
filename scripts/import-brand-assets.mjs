#!/usr/bin/env node
/**
 * Builds the Logos and Fonts archive entries.
 *
 * Logos: Rockstar's GTA VI marks, taken from rockstargames.com/VI (the site
 * serves them on large transparent canvases; we trim them tight).
 * Fonts: the GTA Art Deco family in app/fonts, with a specimen image drawn
 * from the font's own outlines so every archive card has a preview.
 *
 * Output:
 *   public/media/logos/<slug>/…, public/media/fonts/<slug>/…
 *   data/generated/brand.json   items read by the database seed
 *
 * Usage: node scripts/import-brand-assets.mjs
 */
import { mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import opentype from "opentype.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "data", "generated", "brand.json");
const VI_MEDIA = "https://www.rockstargames.com/VI/_next/static/media";
const VARIANT_WIDTHS = [480, 960, 1920];

const rel = (abs) => "/" + path.relative(PUBLIC, abs).split(path.sep).join("/");
const bytes = async (p) => (await stat(p)).size;

const LOGOS = [
  { slug: "gta-vi-logo", title: "Grand Theft Auto VI Logo", file: "poster_logo.0c1t44bwef8fc.png", tags: ["logo", "lockup"] },
  { slug: "gta-vi-mark", title: "VI Mark", file: "logo_vi.10u0n9vp0yvf9.png", tags: ["logo", "mark"] },
  { slug: "grand-theft-auto-wordmark", title: "Grand Theft Auto Wordmark", file: "logo_gta.15y_v-277p.w2.png", tags: ["logo", "wordmark"] },
];

const FONTS = [
  { slug: "gta-art-deco-regular", title: "GTA Art Deco Regular", file: "GTAArtDeco-Regular.ttf" },
  { slug: "gta-art-deco-medium", title: "GTA Art Deco Medium", file: "GTAArtDeco-Medium.ttf" },
  { slug: "gta-art-deco-bold", title: "GTA Art Deco Bold", file: "GTAArtDeco-Bold.ttf" },
  { slug: "gta-art-deco-condensed-bold", title: "GTA Art Deco Condensed Bold", file: "GTAArtDeco-Condensed-Bold.ttf" },
];

async function variants(dir, input, width, alpha) {
  const out = [];
  for (const vw of VARIANT_WIDTHS.filter((w) => w < width).concat(width <= 1920 ? [width] : [])) {
    const file = path.join(dir, `w${vw}.webp`);
    const info = await sharp(input).resize({ width: vw }).webp({ quality: vw <= 480 ? 74 : 82, alphaQuality: 92 }).toFile(file);
    out.push({ width: info.width, height: info.height, url: rel(file), bytes: info.size, format: "webp" });
  }
  const blur = await sharp(input).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(input).stats();
  const hex = "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { variants: out, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`, dominantColor: alpha ? null : hex };
}

async function logo(l) {
  const dir = path.join(PUBLIC, "media", "logos", l.slug);
  await mkdir(dir, { recursive: true });
  const res = await fetch(`${VI_MEDIA}/${l.file}`, { headers: { "user-agent": "Mozilla/5.0 (GTA6Hub asset import)" } });
  if (!res.ok) throw new Error(`${l.file}: ${res.status}`);
  const original = path.join(dir, "original.png");
  const info = await sharp(Buffer.from(await res.arrayBuffer()))
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9 })
    .toFile(original);
  const v = await variants(dir, original, info.width, true);
  return {
    slug: l.slug,
    title: l.title,
    kind: "image",
    category: "logos",
    tags: l.tags,
    width: info.width,
    height: info.height,
    original: { url: rel(original), width: info.width, height: info.height, bytes: await bytes(original), mimeType: "image/png", filename: `${l.slug}.png`, hasAlpha: true },
    ...v,
    officialUrl: "https://www.rockstargames.com/VI",
  };
}

/**
 * Text as an SVG path drawn from the font's own glyph outlines. Glyphs are
 * placed one by one: opentype.js's whole-string layout (substitutions and
 * kerning) yields NaN coordinates for this family.
 */
function textPath(font, text, x, y, size, fill) {
  const scale = size / font.unitsPerEm;
  let cursor = x;
  const parts = [];
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    parts.push(glyph.getPath(cursor, y, size).toPathData(2));
    cursor += (glyph.advanceWidth ?? 0) * scale;
  }
  return `<path d="${parts.join("")}" fill="${fill}"/>`;
}

async function font(f) {
  const dir = path.join(PUBLIC, "media", "fonts", f.slug);
  await mkdir(dir, { recursive: true });
  const src = path.join(ROOT, "app", "fonts", f.file);
  const dest = path.join(dir, f.file);
  await copyFile(src, dest);
  const parsed = opentype.parse((await import("node:fs")).readFileSync(src).buffer);
  const W = 1920;
  const H = 1080;
  const name = parsed.names.fullName?.en ?? f.title;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1630"/><stop offset="1" stop-color="#120c18"/></linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e445b8"/><stop offset=".5" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ff8a73"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${textPath(parsed, "Aa", 120, 560, 460, "url(#s)")}
    ${textPath(parsed, "Welcome to Leonida", 120, 760, 104, "#f8f0f6")}
    ${textPath(parsed, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 120, 880, 58, "rgba(248,240,246,0.62)")}
    ${textPath(parsed, "abcdefghijklmnopqrstuvwxyz 0123456789", 120, 960, 58, "rgba(248,240,246,0.62)")}
    ${textPath(parsed, name, 1080, 210, 64, "rgba(248,240,246,0.85)")}
  </svg>`;
  const specimen = path.join(dir, "specimen.png");
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(specimen);
  const v = await variants(dir, specimen, W, false);
  return {
    slug: f.slug,
    title: f.title,
    kind: "font",
    category: "fonts",
    tags: ["font", "typeface", "art deco"],
    width: W,
    height: H,
    original: { url: rel(dest), bytes: await bytes(dest), mimeType: "font/ttf", filename: f.file },
    poster: { url: rel(specimen), width: W, height: H, bytes: await bytes(specimen), mimeType: "image/png", filename: "specimen.png" },
    font: { family: parsed.names.fontFamily?.en ?? f.title, style: parsed.names.fontSubfamily?.en ?? "Regular", glyphs: parsed.glyphs.length, format: "TrueType" },
    ...v,
  };
}

const items = [];
for (const l of LOGOS) {
  items.push(await logo(l));
  console.log(`logo  ${l.slug}`);
}
for (const f of FONTS) {
  items.push(await font(f));
  console.log(`font  ${f.slug}`);
}
await writeFile(OUT, JSON.stringify({ items }, null, 2) + "\n");
console.log(`Wrote ${path.relative(ROOT, OUT)} (${items.length} items)`);
