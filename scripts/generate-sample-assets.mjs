#!/usr/bin/env node
/**
 * Generates the development sample media set used by GTA 6 Hub.
 *
 * None of these files are official Rockstar Games media. They are procedural
 * stand-ins (clearly watermarked) that exercise the real media pipeline:
 * high-resolution originals, responsive thumbnail variants, blur placeholders,
 * video posters, storyboard sprites and real encoded audio/video with
 * accurate technical metadata.
 *
 * Output:
 *   public/media/<slug>/...           files served by the site
 *   data/generated/sample-assets.json technical manifest consumed by the
 *                                     local content source (lib/content)
 *
 * Usage: node scripts/generate-sample-assets.mjs [--force] [--only slug,slug]
 */
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_MEDIA = path.join(ROOT, "public", "media");
const MANIFEST_PATH = path.join(ROOT, "data", "generated", "sample-assets.json");
const VARIANT_WIDTHS = [480, 960, 1920];

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = (() => {
  const i = args.indexOf("--only");
  return i >= 0 ? new Set(args[i + 1].split(",")) : null;
})();

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashSeed = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */
const PALETTES = {
  dusk: { sky: ["#161a38", "#4a2f5c", "#b4546b", "#f19862", "#ffd49a"], sun: "#ffe4b5", water: ["#4b3552", "#171628"], sil: "#0e0b17", window: "#ffc978", haze: "#f0a06e", stars: false },
  rose: { sky: ["#221a3a", "#5d3469", "#cf6a88", "#ffab98", "#ffe2c6"], sun: "#fff0dc", water: ["#6a4a6e", "#1f1a30"], sil: "#140f1f", window: "#ffd29a", haze: "#f6b3a3", stars: false },
  golden: { sky: ["#2c4a73", "#7d8fb0", "#e6b27a", "#fbe2b4"], sun: "#fff3d6", water: ["#6c8aa0", "#243a50"], sil: "#1b1e2a", window: "#ffe3a3", haze: "#f2cf9a", stars: false },
  night: { sky: ["#03050b", "#0a1226", "#18264a", "#2c3d6b"], sun: "#e6ecff", water: ["#101a33", "#04070e"], sil: "#04060c", window: "#ffcf7a", haze: "#34467a", stars: true },
  day: { sky: ["#2f7fc4", "#6fb2e3", "#bfe3f5", "#eef8fc"], sun: "#ffffff", water: ["#27b8c6", "#0b6a86"], sil: "#35525a", window: "#e3edf1", haze: "#d6eef6", stars: false },
  mist: { sky: ["#8aa498", "#b6c2ab", "#dbd6b8", "#f0e7c9"], sun: "#fff7e0", water: ["#72846e", "#34443a"], sil: "#1e2a22", window: "#f0e2b0", haze: "#e2dcc0", stars: false },
  storm: { sky: ["#1b2127", "#323b44", "#57616a", "#80888a"], sun: null, water: ["#3d474e", "#171d22"], sil: "#10151a", window: "#f5d38c", haze: "#6d7679", stars: false },
  haze: { sky: ["#6b6f78", "#a59a8a", "#d8b98c", "#efd9b0"], sun: "#fff0cf", water: ["#8a8a80", "#3d3d38"], sil: "#26221f", window: "#ffdca0", haze: "#d9c3a0", stars: false },
};

/* ------------------------------------------------------------------ */
/* Scene layers                                                        */
/* ------------------------------------------------------------------ */
function skyLayer(W, H, hz, p) {
  const stops = p.sky.map((c, i) => `<stop offset="${(i / (p.sky.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join("");
  return {
    defs: `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="${hz}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`,
    body: `<rect width="${W}" height="${hz + 2}" fill="url(#sky)"/>`,
  };
}

function starsLayer(W, hz, r) {
  let s = "";
  for (let i = 0; i < 520; i++) {
    const x = r() * W;
    const y = r() * hz * 0.75;
    const rad = (r() * 1.4 + 0.4) * (W / 3840);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="#ffffff" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`;
  }
  return { defs: "", body: s };
}

function sunLayer(W, H, hz, p, r, opts) {
  if (!p.sun) return { defs: "", body: "" };
  const u = Math.min(W, H);
  const sx = opts.sunX ?? W * (0.25 + r() * 0.5);
  const sy = opts.sunY ?? hz - u * (0.08 + r() * 0.18);
  const sr = u * (opts.night ? 0.035 : 0.07);
  return {
    defs: `<radialGradient id="glow" cx="${sx}" cy="${sy}" r="${u * 0.9}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.sun}" stop-opacity="0.55"/><stop offset="0.25" stop-color="${p.haze}" stop-opacity="0.22"/><stop offset="1" stop-color="${p.haze}" stop-opacity="0"/></radialGradient>`,
    body: `<rect width="${W}" height="${hz}" fill="url(#glow)"/><circle cx="${sx}" cy="${sy}" r="${sr}" fill="${p.sun}" opacity="0.96"/>`,
    sx,
    sy,
  };
}

function cloudsLayer(W, H, hz, p, r, count = 7) {
  let s = "";
  const u = Math.min(W, H);
  for (let i = 0; i < count; i++) {
    const cx = r() * W;
    const cy = hz * (0.12 + r() * 0.55);
    const rx = u * (0.2 + r() * 0.45);
    const ry = u * (0.018 + r() * 0.035);
    const col = mix(p.haze, "#ffffff", 0.35);
    s += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${col}" opacity="${(0.12 + r() * 0.2).toFixed(2)}" filter="url(#soft)"/>`;
  }
  return { defs: `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(u * 0.012).toFixed(1)}"/></filter>`, body: s };
}

function ridge(W, baseY, amp, r, roughness = 0.5, step = 40) {
  let y = baseY - amp * r();
  let d = `M0 ${baseY + amp} L0 ${y.toFixed(1)}`;
  for (let x = step; x <= W + step; x += step) {
    y += (r() - 0.5) * amp * roughness;
    y = Math.max(baseY - amp, Math.min(baseY + amp * 0.2, y));
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return d + ` L${W + step} ${baseY + amp * 3} L0 ${baseY + amp * 3} Z`;
}

function mountainsLayer(W, H, hz, p, r, layers = 3, height = 0.28) {
  let s = "";
  for (let i = 0; i < layers; i++) {
    const depth = (i + 1) / layers;
    const col = mix(p.haze, p.sil, 0.25 + depth * 0.7);
    const amp = H * height * (1.1 - depth * 0.45);
    s += `<path d="${ridge(W, hz - amp * 0.2 + i * H * 0.03, amp, r, 0.55, Math.round(W / 140))}" fill="${col}"/>`;
  }
  return { defs: "", body: s };
}

function skylineLayer(W, H, hz, p, r, opts) {
  const u = W / 3840;
  let far = "";
  let near = "";
  let windows = "";
  const litChance = opts.lit ?? 0.3;
  const density = opts.density ?? 1;
  const x0 = opts.fromX ?? 0;
  const x1 = opts.toX ?? W;
  // far layer
  for (let x = x0; x < x1; ) {
    const bw = (60 + r() * 140) * u;
    const bh = (H * 0.05 + r() * H * 0.17) * density;
    far += `<rect x="${x.toFixed(0)}" y="${(hz - bh).toFixed(0)}" width="${(bw + 1).toFixed(0)}" height="${(bh + 4).toFixed(0)}" fill="${mix(p.haze, p.sil, 0.55)}"/>`;
    x += bw;
  }
  // near layer with windows
  for (let x = x0; x < x1; ) {
    const bw = (90 + r() * 220) * u;
    const tall = r() < 0.18 * density;
    const bh = (tall ? H * (0.2 + r() * 0.2) : H * (0.04 + r() * 0.12)) * density;
    const top = hz - bh;
    near += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${(bw + 1).toFixed(0)}" height="${(bh + 4).toFixed(0)}" fill="${p.sil}"/>`;
    if (tall && r() < 0.5) {
      near += `<rect x="${(x + bw * 0.45).toFixed(0)}" y="${(top - bh * 0.12).toFixed(0)}" width="${(bw * 0.08).toFixed(0)}" height="${(bh * 0.12 + 2).toFixed(0)}" fill="${p.sil}"/>`;
    }
    const ww = 7 * u;
    const wh = 11 * u;
    const gx = 18 * u;
    const gy = 24 * u;
    for (let wy = top + gy * 0.7; wy < hz - gy * 0.5; wy += gy) {
      for (let wx = x + gx * 0.6; wx < x + bw - gx * 0.6; wx += gx) {
        if (r() < litChance) {
          windows += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${ww.toFixed(1)}" height="${wh.toFixed(1)}" fill="${p.window}" opacity="${(0.45 + r() * 0.55).toFixed(2)}"/>`;
        }
      }
    }
    x += bw + r() * 30 * u;
  }
  return { defs: "", body: far + near + windows };
}

function waterLayer(W, H, hz, p, r, sun) {
  let s = `<rect y="${hz}" width="${W}" height="${H - hz}" fill="url(#water)"/>`;
  const u = W / 3840;
  // ripples
  for (let i = 0; i < 260; i++) {
    const y = hz + Math.pow(r(), 1.6) * (H - hz);
    const len = (40 + r() * 260) * u * (1 + (y - hz) / (H - hz));
    const x = r() * W;
    s += `<rect x="${x.toFixed(0)}" y="${y.toFixed(1)}" width="${len.toFixed(0)}" height="${(1.2 + ((y - hz) / (H - hz)) * 3).toFixed(1)}" fill="#ffffff" opacity="${(0.03 + r() * 0.07).toFixed(2)}"/>`;
  }
  // sun reflection column
  if (sun && sun.sx) {
    for (let i = 0; i < 120; i++) {
      const y = hz + r() * (H - hz) * 0.85;
      const spread = (20 + (y - hz) * 0.35) * (0.4 + r());
      const len = (30 + r() * 180) * u;
      s += `<rect x="${(sun.sx - spread / 2 + (r() - 0.5) * spread).toFixed(0)}" y="${y.toFixed(1)}" width="${len.toFixed(0)}" height="${(2 + r() * 3).toFixed(1)}" fill="${p.sun}" opacity="${(0.15 + r() * 0.45).toFixed(2)}"/>`;
    }
  }
  return {
    defs: `<linearGradient id="water" x1="0" y1="${hz}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.water[0]}"/><stop offset="1" stop-color="${p.water[1]}"/></linearGradient>`,
    body: s,
  };
}

function groundLayer(W, H, hz, p) {
  return {
    defs: `<linearGradient id="ground" x1="0" y1="${hz}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${mix(p.sil, p.haze, 0.25)}"/><stop offset="1" stop-color="${p.sil}"/></linearGradient>`,
    body: `<rect y="${hz}" width="${W}" height="${H - hz}" fill="url(#ground)"/>`,
  };
}

function palm(x, baseY, h, lean, col, r) {
  const topX = x + lean * h;
  const topY = baseY - h;
  const tw = h * 0.028;
  let s = `<path d="M${x - tw} ${baseY} Q${x + lean * h * 0.2} ${baseY - h * 0.55} ${topX - tw * 0.4} ${topY} L${topX + tw * 0.4} ${topY} Q${x + lean * h * 0.2 + tw * 2} ${baseY - h * 0.55} ${x + tw} ${baseY} Z" fill="${col}"/>`;
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const ang = (i / fronds) * Math.PI * 2 + r() * 0.4;
    const len = h * (0.28 + r() * 0.12);
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.45 + len * 0.35;
    const cx = topX + Math.cos(ang) * len * 0.5;
    const cy = topY - len * 0.25 + Math.sin(ang) * len * 0.1;
    s += `<path d="M${topX} ${topY} Q${cx} ${cy} ${ex} ${ey} Q${cx} ${cy + h * 0.035} ${topX} ${topY + h * 0.01} Z" fill="${col}"/>`;
  }
  return s;
}

function palmsLayer(W, H, p, r, count, side) {
  let s = "";
  for (let i = 0; i < count; i++) {
    const x = side === "left" ? W * (0.02 + r() * 0.2) : side === "right" ? W * (0.78 + r() * 0.2) : W * r();
    const h = H * (0.45 + r() * 0.4);
    const lean = (side === "left" ? 1 : -1) * (0.05 + r() * 0.18);
    s += palm(x, H * 1.02, h, lean, p.sil, r);
  }
  return { defs: "", body: s };
}

function swampLayer(W, H, hz, p, r) {
  let s = "";
  const u = W / 3840;
  // cypress trees on the horizon
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const h = H * (0.08 + r() * 0.22);
    const w = h * (0.18 + r() * 0.12);
    const col = mix(p.haze, p.sil, 0.4 + r() * 0.5);
    s += `<path d="M${x} ${hz + 4} L${x - w * 0.08} ${hz - h * 0.6} Q${x - w * 0.6} ${hz - h * 0.75} ${x - w * 0.3} ${hz - h} Q${x} ${hz - h * 1.08} ${x + w * 0.35} ${hz - h * 0.95} Q${x + w * 0.6} ${hz - h * 0.7} ${x + w * 0.08} ${hz - h * 0.6} L${x + w * 0.05} ${hz + 4} Z" fill="${col}"/>`;
  }
  // reeds in the foreground
  for (let i = 0; i < 480; i++) {
    const x = r() * W;
    const base = H - r() * (H - hz) * 0.35;
    const h = (60 + r() * 260) * u;
    const bend = (r() - 0.5) * 60 * u;
    s += `<path d="M${x.toFixed(0)} ${base.toFixed(0)} q${(bend / 2).toFixed(0)} ${(-h / 2).toFixed(0)} ${bend.toFixed(0)} ${(-h).toFixed(0)}" stroke="${mix(p.sil, p.haze, r() * 0.2)}" stroke-width="${(2 + r() * 3) * u}" fill="none" opacity="0.9"/>`;
  }
  return { defs: "", body: s };
}

function bridgeLayer(W, H, hz, p, r) {
  const y = hz + (H - hz) * 0.08;
  const thick = H * 0.012;
  let s = `<rect x="0" y="${y}" width="${W}" height="${thick}" fill="${mix(p.sil, p.haze, 0.2)}"/>`;
  for (let x = W * 0.02; x < W; x += W * 0.06) {
    s += `<rect x="${x}" y="${y + thick}" width="${W * 0.006}" height="${(H - hz) * 0.12}" fill="${mix(p.sil, p.haze, 0.3)}"/>`;
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * W;
    s += `<rect x="${x}" y="${y - thick * 0.4}" width="${W * 0.004}" height="${thick * 0.35}" fill="${r() < 0.5 ? "#ffe9b8" : "#ff6a5a"}" opacity="0.85"/>`;
  }
  return { defs: "", body: s };
}

function industrialLayer(W, H, hz, p, r) {
  let s = "";
  const u = W / 3840;
  for (let i = 0; i < 12; i++) {
    const x = r() * W;
    const w = (120 + r() * 220) * u;
    const h = (80 + r() * 160) * u;
    const col = mix(p.sil, p.haze, 0.15 + r() * 0.15);
    s += `<rect x="${x}" y="${hz - h}" width="${w}" height="${h + 4}" fill="${col}"/><ellipse cx="${x + w / 2}" cy="${hz - h}" rx="${w / 2}" ry="${w * 0.08}" fill="${col}"/>`;
  }
  for (let i = 0; i < 7; i++) {
    const x = r() * W;
    const h = H * (0.15 + r() * 0.2);
    const w = (18 + r() * 20) * u;
    s += `<rect x="${x}" y="${hz - h}" width="${w}" height="${h}" fill="${p.sil}"/>`;
    for (let k = 0; k < 5; k++) {
      s += `<circle cx="${x + w / 2 + k * 30 * u}" cy="${hz - h - k * 60 * u}" r="${(40 + k * 30) * u}" fill="${p.haze}" opacity="${0.18 - k * 0.03}" filter="url(#soft)"/>`;
    }
  }
  // cranes
  for (let i = 0; i < 4; i++) {
    const x = W * (0.1 + r() * 0.8);
    const h = H * (0.2 + r() * 0.15);
    const armL = W * (0.08 + r() * 0.06);
    s += `<path d="M${x} ${hz} L${x} ${hz - h} L${x + armL} ${hz - h} M${x - armL * 0.3} ${hz - h} L${x} ${hz - h} M${x + armL * 0.8} ${hz - h} L${x + armL * 0.8} ${hz - h * 0.6}" stroke="${p.sil}" stroke-width="${10 * u}" fill="none"/>`;
  }
  return { defs: "", body: s };
}

function roadLayer(W, H, hz, p, r) {
  const vx = W * 0.5;
  let s = `<path d="M${vx - W * 0.01} ${hz} L${vx + W * 0.01} ${hz} L${W * 0.95} ${H} L${W * 0.05} ${H} Z" fill="${mix(p.sil, "#222222", 0.3)}"/>`;
  for (let i = 0; i < 160; i++) {
    const t = Math.pow(r(), 2.2);
    const y = hz + t * (H - hz);
    const lane = r() < 0.5 ? -1 : 1;
    const x = vx + lane * t * W * (0.1 + r() * 0.3);
    const rad = (2 + t * 16) * (W / 3840);
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${lane < 0 ? "#fff3d0" : "#ff4d4d"}" opacity="${0.4 + r() * 0.5}"/>`;
  }
  for (let i = 1; i < 14; i++) {
    const t = Math.pow(i / 14, 2);
    const y = hz + t * (H - hz);
    s += `<rect x="${vx - (2 + t * 10)}" y="${y}" width="${4 + t * 20}" height="${6 + t * 70}" fill="#e8e1c9" opacity="0.55"/>`;
  }
  return { defs: "", body: s };
}

function figureLayer(W, H, p) {
  const cx = W * 0.5;
  const base = H;
  const s = Math.min(W, H * 0.62);
  const head = s * 0.13;
  const hy = base - s * 0.95;
  const body = `<path d="M${cx - s * 0.46} ${base} Q${cx - s * 0.44} ${hy + s * 0.42} ${cx - s * 0.16} ${hy + s * 0.3} L${cx - s * 0.07} ${hy + s * 0.18} L${cx + s * 0.07} ${hy + s * 0.18} L${cx + s * 0.16} ${hy + s * 0.3} Q${cx + s * 0.44} ${hy + s * 0.42} ${cx + s * 0.46} ${base} Z" fill="${p.sil}"/>`;
  const headEl = `<ellipse cx="${cx}" cy="${hy}" rx="${head * 0.82}" ry="${head}" fill="${p.sil}"/>`;
  const rim = `<ellipse cx="${cx + head * 0.2}" cy="${hy}" rx="${head * 0.84}" ry="${head * 1.02}" fill="none" stroke="${p.sun || p.haze}" stroke-width="${s * 0.006}" opacity="0.55"/>`;
  return { defs: "", body: rim + headEl + body };
}

function vignetteLayer(W, H) {
  return {
    defs: `<radialGradient id="vig" cx="${W / 2}" cy="${H / 2}" r="${Math.hypot(W, H) * 0.55}" gradientUnits="userSpaceOnUse"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>`,
    body: `<rect width="${W}" height="${H}" fill="url(#vig)"/>`,
  };
}

function grainLayer(W, H) {
  return {
    defs: `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`,
    body: `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.07"/>`,
  };
}

function watermark(W, H, slug, light = true) {
  const u = Math.min(W, H) / 2160;
  const fs = Math.max(14, 26 * u);
  const pad = 48 * u;
  const col = light ? "#ffffff" : "#111111";
  return {
    defs: "",
    body:
      `<g font-family="Arial, Helvetica, sans-serif" fill="${col}" opacity="0.72">` +
      `<text x="${pad}" y="${H - pad}" font-size="${fs}" font-weight="700" letter-spacing="${fs * 0.12}">GTA 6 HUB · SAMPLE ASSET</text>` +
      `<text x="${pad}" y="${H - pad - fs * 1.5}" font-size="${fs * 0.8}" letter-spacing="${fs * 0.06}">${slug.toUpperCase()}</text>` +
      `<text x="${W - pad}" y="${H - pad}" font-size="${fs * 0.8}" text-anchor="end" letter-spacing="${fs * 0.06}">NOT OFFICIAL ROCKSTAR GAMES MEDIA</text>` +
      `</g>`,
  };
}

/* ------------------------------------------------------------------ */
/* Scene composition                                                   */
/* ------------------------------------------------------------------ */
function composeScene(spec) {
  const { w: W, h: H, slug } = spec;
  const sc = spec.scene;
  const p = PALETTES[sc.palette];
  const r = rng(hashSeed(slug));
  const hz = Math.round(H * (sc.horizon ?? 0.62));
  const layers = [];
  layers.push(skyLayer(W, H, hz, p));
  if (p.stars) layers.push(starsLayer(W, hz, r));
  const sun = sunLayer(W, H, hz, p, r, { night: sc.palette === "night", sunX: sc.sunX ? W * sc.sunX : undefined });
  layers.push(sun);
  if (sc.clouds !== 0) layers.push(cloudsLayer(W, H, hz, p, r, sc.clouds ?? 7));
  else layers.push({ defs: `<filter id="soft"><feGaussianBlur stdDeviation="${Math.min(W, H) * 0.012}"/></filter>`, body: "" });
  if (sc.mountains) layers.push(mountainsLayer(W, H, hz, p, r, sc.mountains, sc.mountainHeight ?? 0.28));
  if (sc.skyline) layers.push(skylineLayer(W, H, hz, p, r, sc.skyline));
  if (sc.industrial) layers.push(industrialLayer(W, H, hz, p, r));
  if (sc.swamp) layers.push(swampLayer(W, H, hz, p, r));
  if (sc.ground === "road") {
    layers.push(groundLayer(W, H, hz, p));
    layers.push(roadLayer(W, H, hz, p, r));
  } else if (sc.ground === "land") {
    layers.push(groundLayer(W, H, hz, p));
  } else {
    layers.push(waterLayer(W, H, hz, p, r, sun));
  }
  if (sc.swamp) layers.push(swampLayer(W, H, H - (H - hz) * 0.1, p, r));
  if (sc.bridge) layers.push(bridgeLayer(W, H, hz, p, r));
  if (sc.palms) layers.push(palmsLayer(W, H, p, r, sc.palms.count, sc.palms.side));
  if (sc.figure) layers.push(figureLayer(W, H, p));
  layers.push(vignetteLayer(W, H));
  layers.push(grainLayer(W, H));
  if (sc.title) {
    const u = Math.min(W, H) / 2160;
    layers.push({
      defs: "",
      body: `<g font-family="Arial, Helvetica, sans-serif" fill="#ffffff"><text x="${W / 2}" y="${H * 0.16}" text-anchor="middle" font-size="${120 * u}" font-weight="900" letter-spacing="${14 * u}">${sc.title}</text>${sc.subtitle ? `<text x="${W / 2}" y="${H * 0.16 + 90 * u}" text-anchor="middle" font-size="${40 * u}" letter-spacing="${10 * u}" opacity="0.8">${sc.subtitle}</text>` : ""}</g>`,
    });
  }
  layers.push(watermark(W, H, slug));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${layers.map((l) => l.defs).join("")}</defs>${layers.map((l) => l.body).join("")}</svg>`;
}

function composeLogo(spec) {
  const { w: W, h: H, slug } = spec;
  const dark = spec.logo.tone === "dark";
  const fg = dark ? "#121212" : "#f4f2ee";
  const u = Math.min(W, H) / 800;
  if (spec.logo.kind === "monogram") {
    const s = Math.min(W, H);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g transform="translate(${W / 2} ${H / 2})"><rect x="${-s * 0.36}" y="${-s * 0.36}" width="${s * 0.72}" height="${s * 0.72}" fill="none" stroke="${fg}" stroke-width="${s * 0.03}"/><text y="${s * 0.12}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${s * 0.34}" fill="${fg}">VI</text><text y="${s * 0.3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${s * 0.035}" letter-spacing="${s * 0.012}" fill="${fg}">SAMPLE MARK</text></g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g font-family="Arial Black, Arial, sans-serif" fill="${fg}"><text x="${W / 2}" y="${H * 0.58}" text-anchor="middle" font-weight="900" font-size="${260 * u}" letter-spacing="${10 * u}">SAMPLE</text><text x="${W / 2}" y="${H * 0.8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${54 * u}" letter-spacing="${26 * u}">PLACEHOLDER WORDMARK</text></g><text x="${W - 30 * u}" y="${H - 24 * u}" text-anchor="end" font-family="Arial, sans-serif" font-size="${22 * u}" fill="${fg}" opacity="0.6">${slug.toUpperCase()} · NOT OFFICIAL</text></svg>`;
}

/* ------------------------------------------------------------------ */
/* Asset specs                                                         */
/* ------------------------------------------------------------------ */
const K4 = { w: 3840, h: 2160 };
const HD = { w: 1920, h: 1080 };
const IMAGES = [
  { slug: "ss-ocean-drive-dusk", ...K4, scene: { palette: "dusk", skyline: { lit: 0.22 }, palms: { count: 3, side: "left" }, horizon: 0.64 } },
  { slug: "ss-downtown-night", ...K4, scene: { palette: "night", skyline: { lit: 0.42, density: 1.4 }, horizon: 0.7, clouds: 3 } },
  { slug: "ss-causeway-golden", ...K4, scene: { palette: "golden", skyline: { lit: 0.08, toX: 1600 }, bridge: true, horizon: 0.58 } },
  { slug: "ss-keys-shallows", ...K4, scene: { palette: "day", horizon: 0.52, palms: { count: 2, side: "right" }, clouds: 9 } },
  { slug: "ss-keys-marina-noon", ...K4, scene: { palette: "day", skyline: { lit: 0, density: 0.35 }, horizon: 0.6, bridge: true } },
  { slug: "ss-grassrivers-mist", ...K4, scene: { palette: "mist", swamp: true, horizon: 0.6, clouds: 4 } },
  { slug: "ss-grassrivers-airboat-dusk", ...K4, scene: { palette: "rose", swamp: true, horizon: 0.62 } },
  { slug: "ss-kalaga-ridgeline", ...K4, scene: { palette: "golden", mountains: 4, mountainHeight: 0.32, ground: "land", horizon: 0.72 } },
  { slug: "ss-kalaga-overcast", ...K4, scene: { palette: "storm", mountains: 3, ground: "land", horizon: 0.7, clouds: 12 } },
  { slug: "ss-port-gellhorn-docks", ...K4, scene: { palette: "storm", industrial: true, horizon: 0.62, clouds: 10 } },
  { slug: "ss-ambrosia-refinery", ...K4, scene: { palette: "haze", industrial: true, ground: "land", horizon: 0.66 } },
  { slug: "ss-beachfront-daylight", ...K4, scene: { palette: "day", skyline: { lit: 0, density: 0.8 }, palms: { count: 3, side: "right" }, horizon: 0.6 } },
  { slug: "ss-skyline-storm", ...K4, scene: { palette: "storm", skyline: { lit: 0.12, density: 1.2 }, horizon: 0.68, clouds: 14 } },
  { slug: "ss-motel-strip-night", ...K4, scene: { palette: "night", skyline: { lit: 0.3, density: 0.45 }, ground: "road", horizon: 0.58 } },
  { slug: "tf1-opening-coast", ...HD, scene: { palette: "rose", skyline: { lit: 0.15 }, palms: { count: 2, side: "right" }, horizon: 0.62 } },
  { slug: "tf1-city-lights", ...HD, scene: { palette: "night", skyline: { lit: 0.5, density: 1.3 }, horizon: 0.68 } },
  { slug: "tf2-keys-sunrise", ...K4, scene: { palette: "golden", horizon: 0.55, palms: { count: 2, side: "left" }, bridge: true } },
  { slug: "tf2-highway-night", ...K4, scene: { palette: "night", ground: "road", skyline: { lit: 0.35, density: 0.9 }, horizon: 0.52 } },
  // artwork
  { slug: "art-key-art-landscape", w: 5120, h: 2880, scene: { palette: "dusk", skyline: { lit: 0.25, density: 1.1 }, palms: { count: 4, side: "right" }, horizon: 0.63 } },
  { slug: "art-poster-portrait", w: 2400, h: 3600, scene: { palette: "rose", skyline: { lit: 0.2, density: 1.4 }, palms: { count: 2, side: "left" }, horizon: 0.66, title: "SAMPLE", subtitle: "POSTER ARTWORK" } },
  { slug: "art-character-lucia-portrait", w: 2160, h: 3840, scene: { palette: "dusk", figure: true, horizon: 0.55, skyline: { lit: 0.2 } } },
  { slug: "art-character-jason-portrait", w: 2160, h: 3840, scene: { palette: "golden", figure: true, horizon: 0.55, palms: { count: 2, side: "right" } } },
  { slug: "art-vice-city-panorama", w: 7200, h: 2400, scene: { palette: "dusk", skyline: { lit: 0.3, density: 1.2 }, horizon: 0.62, bridge: true } },
  { slug: "art-grassrivers-painting", w: 3000, h: 3000, scene: { palette: "mist", swamp: true, horizon: 0.58 } },
  // promotional
  { slug: "promo-social-square", w: 2048, h: 2048, scene: { palette: "rose", palms: { count: 2, side: "left" }, horizon: 0.6, title: "SAMPLE", subtitle: "PROMOTIONAL SQUARE" } },
  { slug: "promo-social-portrait", w: 1080, h: 1350, scene: { palette: "night", skyline: { lit: 0.4, density: 1.2 }, horizon: 0.7, title: "SAMPLE", subtitle: "SOCIAL 4:5" } },
  { slug: "promo-banner-ultrawide", w: 3440, h: 1440, scene: { palette: "golden", bridge: true, skyline: { lit: 0.05, toX: 1400 }, horizon: 0.6, title: "SAMPLE BANNER" } },
  { slug: "promo-billboard", w: 4000, h: 2000, scene: { palette: "dusk", palms: { count: 3, side: "left" }, horizon: 0.58, title: "SAMPLE BILLBOARD" } },
];
const LOGOS = [
  { slug: "logo-wordmark-light", w: 2400, h: 800, logo: { kind: "wordmark", tone: "light" } },
  { slug: "logo-wordmark-dark", w: 2400, h: 800, logo: { kind: "wordmark", tone: "dark" } },
  { slug: "logo-monogram", w: 2048, h: 2048, logo: { kind: "monogram", tone: "light" } },
];
const COVERS = [
  { slug: "audio-theme-sample", w: 1500, h: 1500, scene: { palette: "rose", palms: { count: 2, side: "left" }, horizon: 0.62, title: "SAMPLE", subtitle: "THEME" } },
  { slug: "audio-radio-sample", w: 1500, h: 1500, scene: { palette: "night", skyline: { lit: 0.4 }, horizon: 0.7, title: "SAMPLE", subtitle: "RADIO" } },
  { slug: "audio-ambience-sample", w: 1500, h: 1500, scene: { palette: "mist", swamp: true, horizon: 0.6, title: "SAMPLE", subtitle: "AMBIENCE" } },
];
const VIDEOS = [
  { slug: "video-trailer-1-sample", w: 1920, h: 1080, fps: 30, seg: 6.5, fade: 0.6, scenes: ["tf1-opening-coast", "ss-ocean-drive-dusk", "tf1-city-lights", "ss-downtown-night"], tone: 1 },
  { slug: "video-trailer-2-sample", w: 1920, h: 1080, fps: 24, seg: 6.5, fade: 0.6, scenes: ["tf2-keys-sunrise", "ss-grassrivers-airboat-dusk", "ss-kalaga-ridgeline", "tf2-highway-night"], tone: 2 },
  { slug: "video-gameplay-clip-60fps", w: 1280, h: 720, fps: 60, seg: 5.5, fade: 0.5, scenes: ["ss-keys-shallows", "ss-causeway-golden"], tone: 3 },
];
const AUDIO = [
  { slug: "audio-theme-sample", duration: 42, expr: themeExpr },
  { slug: "audio-radio-sample", duration: 32, expr: radioExpr },
  { slug: "audio-ambience-sample", duration: 36, expr: ambienceExpr },
];

function themeExpr() {
  const pad = "0.10*sin(2*PI*220*t)+0.07*sin(2*PI*277.18*t)+0.07*sin(2*PI*329.63*t)";
  const lfo = "(0.65+0.35*sin(2*PI*0.2*t))";
  const kick = "0.45*sin(2*PI*52*t)*exp(-9*mod(t,0.5))";
  const L = `${pad}*${lfo}+${kick}`;
  const R = `${pad.replace(/220/, "221")}*${lfo}+${kick}`;
  return `${L}|${R}`;
}
function radioExpr() {
  const bass = "0.25*sin(2*PI*(55+27.5*gte(mod(t,4),2))*t)*(0.6+0.4*exp(-6*mod(t,0.25)))";
  const hat = "0.05*sin(2*PI*6000*t)*exp(-40*mod(t+0.125,0.25))";
  const lead = "0.08*sin(2*PI*(440+220*gte(mod(t,2),1))*t)*(0.5+0.5*sin(2*PI*2*t))";
  const x = `${bass}+${hat}+${lead}`;
  return `${x}|${x}`;
}
function ambienceExpr() {
  const wind = "0.06*sin(2*PI*110*t+3*sin(2*PI*0.13*t))+0.05*sin(2*PI*164.8*t+2*sin(2*PI*0.07*t))";
  const bird = "0.04*sin(2*PI*(2400+600*sin(2*PI*9*t))*t)*gte(mod(t,5),4.6)";
  return `${wind}+${bird}|${wind}+0.9*${bird}`;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`${cmd} exited ${code}\n${err.slice(-3000)}`))));
  });
}

const rel = (abs) => "/" + path.relative(path.join(ROOT, "public"), abs).split(path.sep).join("/");

async function fileBytes(p) {
  return (await stat(p)).size;
}

async function writeVariants(dir, input, width, alpha) {
  const variants = [];
  for (const vw of VARIANT_WIDTHS) {
    if (vw >= width) continue;
    const out = path.join(dir, `w${vw}.webp`);
    const info = await sharp(input).resize({ width: vw }).webp({ quality: vw <= 480 ? 72 : 80, alphaQuality: 90 }).toFile(out);
    variants.push({ width: info.width, height: info.height, url: rel(out), bytes: info.size, format: "webp" });
  }
  // always provide a variant at the native width when the original is small
  if (variants.length === 0 || width <= 1920) {
    const out = path.join(dir, `w${width}.webp`);
    const info = await sharp(input).webp({ quality: 82, alphaQuality: 90 }).toFile(out);
    variants.push({ width: info.width, height: info.height, url: rel(out), bytes: info.size, format: "webp" });
  }
  const blurBuf = await sharp(input).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(input).stats();
  const hex = "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { variants, blurDataUrl: `data:image/webp;base64,${blurBuf.toString("base64")}`, dominantColor: alpha ? null : hex };
}

async function renderSvg(svg, out, format) {
  const img = sharp(Buffer.from(svg), { limitInputPixels: false, density: 72 });
  if (format === "png") return img.png({ compressionLevel: 9 }).toFile(out);
  return img.jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(out);
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */
async function buildImage(spec, kind) {
  const dir = path.join(PUBLIC_MEDIA, spec.slug);
  await mkdir(dir, { recursive: true });
  const isLogo = kind === "logo";
  const ext = isLogo ? "png" : "jpg";
  const original = path.join(dir, `original.${ext}`);
  const svg = isLogo ? composeLogo(spec) : composeScene(spec);
  await renderSvg(svg, original, ext === "png" ? "png" : "jpeg");
  const v = await writeVariants(dir, original, spec.w, isLogo);
  return {
    kind: "image",
    original: { url: rel(original), width: spec.w, height: spec.h, bytes: await fileBytes(original), mimeType: isLogo ? "image/png" : "image/jpeg", filename: `${spec.slug}.${ext}`, hasAlpha: isLogo },
    variants: v.variants,
    blurDataUrl: v.blurDataUrl,
    dominantColor: v.dominantColor,
  };
}

function parseDuration(stderr) {
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}

async function probe(file) {
  // ffmpeg -i exits non-zero without an output; capture stderr regardless
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-i", file], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", () => resolve(err));
  });
}

async function buildVideo(spec) {
  const dir = path.join(PUBLIC_MEDIA, spec.slug);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, "video.mp4");
  const n = spec.scenes.length;
  const total = n * spec.seg - (n - 1) * spec.fade;
  const inputs = [];
  const chains = [];
  spec.scenes.forEach((s, i) => {
    inputs.push("-loop", "1", "-framerate", String(spec.fps), "-t", String(spec.seg), "-i", path.join(PUBLIC_MEDIA, s, "original.jpg"));
    const dirSign = i % 2 === 0 ? 1 : -1;
    const frames = Math.round(spec.seg * spec.fps);
    chains.push(
      `[${i}:v]scale=${spec.w * 2}:${spec.h * 2}:force_original_aspect_ratio=increase,crop=${spec.w * 2}:${spec.h * 2},` +
        `zoompan=z='1.04+0.10*on/${frames}':x='(iw-iw/zoom)/2+${dirSign}*(on/${frames}-0.5)*iw*0.03':y='(ih-ih/zoom)/2':d=1:s=${spec.w}x${spec.h}:fps=${spec.fps},setsar=1,format=yuv420p[v${i}]`,
    );
  });
  let last = "v0";
  for (let i = 1; i < n; i++) {
    const offset = (i * (spec.seg - spec.fade)).toFixed(3);
    chains.push(`[${last}][v${i}]xfade=transition=fade:duration=${spec.fade}:offset=${offset}[x${i}]`);
    last = `x${i}`;
  }
  const font = "C\\:/Windows/Fonts/consola.ttf";
  const fontOpt = existsSync("C:/Windows/Fonts/consola.ttf") ? `fontfile='${font}':` : "";
  const fs = Math.round(spec.h / 38);
  chains.push(
    `[${last}]drawtext=${fontOpt}text='SAMPLE VIDEO  ${spec.fps} FPS  FRAME %{frame_num}':x=${Math.round(spec.h / 30)}:y=h-${Math.round(spec.h / 14)}:fontsize=${fs}:fontcolor=white@0.9:box=1:boxcolor=black@0.45:boxborderw=${Math.round(fs / 3)},` +
      `drawtext=${fontOpt}text='%{pts\\:hms}':x=w-tw-${Math.round(spec.h / 30)}:y=h-${Math.round(spec.h / 14)}:fontsize=${fs}:fontcolor=white@0.9:box=1:boxcolor=black@0.45:boxborderw=${Math.round(fs / 3)}[vout]`,
  );
  const audioExpr = [themeExpr, radioExpr, ambienceExpr][(spec.tone - 1) % 3]();
  const filterFile = path.join(dir, "filter.txt");
  await writeFile(filterFile, chains.join(";\n"));
  await run(ffmpegPath, [
    "-y",
    "-hide_banner",
    ...inputs,
    "-f", "lavfi", "-t", total.toFixed(3), "-i", `aevalsrc='${audioExpr}':s=48000`,
    "-filter_complex_script", filterFile,
    "-map", "[vout]", "-map", `${n}:a`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-r", String(spec.fps), "-g", String(spec.fps), "-keyint_min", String(spec.fps),
    "-c:a", "aac", "-b:a", "160k", "-ac", "2",
    "-t", total.toFixed(3),
    "-movflags", "+faststart",
    out,
  ]);
  const { unlink } = await import("node:fs/promises");
  await unlink(filterFile).catch(() => {});

  const info = await probe(out);
  const duration = parseDuration(info) ?? total;
  const bytes = await fileBytes(out);

  // poster
  const posterRaw = path.join(dir, "poster.jpg");
  await run(ffmpegPath, ["-y", "-hide_banner", "-ss", "2.5", "-i", out, "-frames:v", "1", "-q:v", "2", posterRaw]);
  const posterVariants = await writeVariants(dir, posterRaw, spec.w, false);

  // storyboard sprite: 1 tile per second
  const count = Math.ceil(duration);
  const cols = 10;
  const rows = Math.ceil(count / cols);
  const tileW = 192;
  const tileH = Math.round((tileW * spec.h) / spec.w);
  const sb = path.join(dir, "storyboard.jpg");
  await run(ffmpegPath, ["-y", "-hide_banner", "-i", out, "-vf", `fps=1,scale=${tileW}:${tileH},tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "5", sb]);

  return {
    kind: "video",
    original: { url: rel(out), width: spec.w, height: spec.h, bytes, mimeType: "video/mp4", filename: `${spec.slug}.mp4` },
    video: {
      duration: +duration.toFixed(3),
      fps: spec.fps,
      frameCount: Math.round(duration * spec.fps),
      videoCodec: "H.264 (High)",
      codecString: "avc1.640028",
      audioCodec: "AAC-LC",
      audioChannels: 2,
      audioSampleRate: 48000,
      bitrate: Math.round((bytes * 8) / duration),
    },
    poster: { url: rel(posterRaw), width: spec.w, height: spec.h, bytes: await fileBytes(posterRaw) },
    variants: posterVariants.variants,
    blurDataUrl: posterVariants.blurDataUrl,
    dominantColor: posterVariants.dominantColor,
    storyboard: { url: rel(sb), interval: 1, columns: cols, rows, tileWidth: tileW, tileHeight: tileH, count },
  };
}

async function buildAudio(spec) {
  const dir = path.join(PUBLIC_MEDIA, spec.slug);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, "audio.mp3");
  await run(ffmpegPath, [
    "-y", "-hide_banner",
    "-f", "lavfi", "-t", String(spec.duration), "-i", `aevalsrc='${spec.expr()}':s=44100`,
    "-af", `afade=t=in:d=1.5,afade=t=out:st=${spec.duration - 2}:d=2,alimiter=limit=0.9`,
    "-c:a", "libmp3lame", "-b:a", "192k",
    out,
  ]);
  const info = await probe(out);
  const duration = parseDuration(info) ?? spec.duration;
  const bytes = await fileBytes(out);
  const coverSpec = COVERS.find((c) => c.slug === spec.slug);
  const cover = path.join(dir, "cover.jpg");
  await renderSvg(composeScene(coverSpec), cover, "jpeg");
  const v = await writeVariants(dir, cover, coverSpec.w, false);
  return {
    kind: "audio",
    original: { url: rel(out), bytes, mimeType: "audio/mpeg", filename: `${spec.slug}.mp3` },
    audio: { duration: +duration.toFixed(3), codec: "MP3", bitrate: 192000, sampleRate: 44100, channels: 2 },
    poster: { url: rel(cover), width: coverSpec.w, height: coverSpec.h, bytes: await fileBytes(cover) },
    variants: v.variants,
    blurDataUrl: v.blurDataUrl,
    dominantColor: v.dominantColor,
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  let manifest = {};
  if (existsSync(MANIFEST_PATH)) manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const want = (slug) => (ONLY ? ONLY.has(slug) : FORCE || !manifest[slug]);
  const t0 = Date.now();
  const save = () => writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  for (const spec of IMAGES) {
    if (!want(spec.slug)) continue;
    process.stdout.write(`image  ${spec.slug} ... `);
    manifest[spec.slug] = await buildImage(spec, "image");
    console.log("ok");
    await save();
  }
  for (const spec of LOGOS) {
    if (!want(spec.slug)) continue;
    process.stdout.write(`logo   ${spec.slug} ... `);
    manifest[spec.slug] = await buildImage(spec, "logo");
    console.log("ok");
    await save();
  }
  for (const spec of VIDEOS) {
    if (!want(spec.slug)) continue;
    process.stdout.write(`video  ${spec.slug} ... `);
    manifest[spec.slug] = await buildVideo(spec);
    console.log("ok");
    await save();
  }
  for (const spec of AUDIO) {
    if (!want(spec.slug)) continue;
    process.stdout.write(`audio  ${spec.slug} ... `);
    manifest[spec.slug] = await buildAudio(spec);
    console.log("ok");
    await save();
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
