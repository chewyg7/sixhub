// Canvas font setup, run measurement and run drawing (incl. per-glyph clipped strokes).
import {
  FONT_PRICEDOWN,
  FONT_PRICEDOWN_FALLBACKS,
  FONT_PRICEDOWN_SS01,
  FONT_SCRIPT,
  FONT_SYSTEM,
  FONT_TITLE,
} from "./config";
import { GLYPH_CLIP, GLYPH_CLIP_SS01, type GlyphClipBox } from "./glyphClip";
import type { FontRun } from "./text";

type Ctx = CanvasRenderingContext2D;

export function setFont(ctx: Ctx, size: number, family: string = FONT_TITLE, letterSpacing = 0): void {
  const fallbacks =
    family === FONT_SCRIPT
      ? `cursive, ${FONT_SYSTEM}`
      : family === FONT_PRICEDOWN || family === FONT_PRICEDOWN_SS01
        ? FONT_PRICEDOWN_FALLBACKS
        : FONT_SYSTEM;
  ctx.font = `${size}px "${family}", ${fallbacks}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  try {
    ctx.fontKerning = "normal";
  } catch {
    /* unsupported */
  }
  try {
    ctx.letterSpacing = `${letterSpacing}px`;
  } catch {
    /* unsupported */
  }
}

export interface RunsMetrics {
  width: number;
  /** Ink that sticks out past the advance box on either side. */
  overhang: number;
  descent: number;
}

export function measureRuns(ctx: Ctx, runs: FontRun[], size: number): RunsMetrics {
  let x = 0;
  let right = 0;
  let left = 0;
  let descent = 0;
  for (const run of runs) {
    setFont(ctx, size, run.family, 0);
    const m = ctx.measureText(run.text);
    right = Math.max(right, x + (m.actualBoundingBoxRight ?? m.width));
    left = Math.max(left, (m.actualBoundingBoxLeft ?? 0) - x);
    descent = Math.max(descent, m.actualBoundingBoxDescent ?? 0);
    x += m.width;
  }
  return { width: x, overhang: Math.max(0, right - x, left), descent };
}

/**
 * Strokes one run glyph by glyph. Glyphs with a clip box are stroked inside the
 * box, so their outline does not bleed into neighbours (e.g. the interlocking
 * R tail); sides listed in `cut` get an extra round-joined stroke strip so the
 * cut edge stays clean. Returns the pen x after the run.
 */
function strokeRunClipped(ctx: Ctx, run: FontRun, size: number, startX: number, baseline: number, clipIndex: 0 | 1): number {
  const table = run.family === FONT_PRICEDOWN_SS01 ? GLYPH_CLIP_SS01 : GLYPH_CLIP;
  const chars = Array.from(run.text);
  let x = startX;
  let i = 0;
  while (i < chars.length) {
    const box: GlyphClipBox | undefined = table[chars[i]]?.[clipIndex];
    if (!box) {
      // Stroke the whole stretch of unclipped glyphs at once.
      let j = i + 1;
      while (j < chars.length && !table[chars[j]]?.[clipIndex]) j++;
      const chunk = chars.slice(i, j).join("");
      ctx.strokeText(chunk, x, baseline);
      x += ctx.measureText(chunk).width;
      i = j;
      continue;
    }
    // Snap a box edge outward by a pixel, or flush to the pixel grid if cut.
    const snap = (v: number, side: string, dir: number) =>
      box.cut.includes(side)
        ? dir < 0
          ? Math.ceil(v)
          : Math.floor(v)
        : dir < 0
          ? Math.floor(v - 1)
          : Math.ceil(v + 1);
    const rawL = x + box.x0 * size;
    const rawR = x + box.x1 * size;
    const rawT = baseline - box.y1 * size;
    const rawB = baseline - box.y0 * size;
    const l = snap(rawL, "l", -1);
    const r = snap(rawR, "r", 1);
    const t = snap(rawT, "t", -1);
    const b = snap(rawB, "b", 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(l, t, r - l, b - t);
    ctx.clip();
    ctx.strokeText(chars[i], x, baseline);
    ctx.restore();

    if (box.cut) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (box.cut.includes("l")) ctx.rect(Math.floor(rawL), t, l - Math.floor(rawL), b - t);
      if (box.cut.includes("r")) ctx.rect(r, t, Math.ceil(rawR) - r, b - t);
      if (box.cut.includes("t")) ctx.rect(l, Math.floor(rawT), r - l, t - Math.floor(rawT));
      if (box.cut.includes("b")) ctx.rect(l, b, r - l, Math.ceil(rawB) - b);
      ctx.clip();
      ctx.strokeText(chars[i], x, baseline);
      ctx.restore();
    }
    x += ctx.measureText(chars[i]).width;
    i++;
  }
  return x;
}

/** Draws runs left to right. Strokes use per-glyph clipping when `clipIndex` is given. */
export function drawRuns(
  ctx: Ctx,
  runs: FontRun[],
  size: number,
  x: number,
  baseline: number,
  mode: "fill" | "stroke",
  clipIndex?: 0 | 1,
): void {
  let pen = x;
  for (const run of runs) {
    setFont(ctx, size, run.family, 0);
    if (mode === "stroke" && clipIndex !== undefined) {
      pen = strokeRunClipped(ctx, run, size, pen, baseline, clipIndex);
      continue;
    }
    if (mode === "fill") ctx.fillText(run.text, pen, baseline);
    else ctx.strokeText(run.text, pen, baseline);
    pen += ctx.measureText(run.text).width;
  }
}

/**
 * Smears the canvas content diagonally down-right by `depth` px using
 * doubling offsets (1, 2, 4, ...), producing a solid extrusion in O(log n) draws.
 */
export function extrudeCanvas(canvas: HTMLCanvasElement, depth: number): void {
  const total = Math.max(0, Math.round(depth));
  const ctx = canvas.getContext("2d");
  if (!ctx || total === 0) return;
  const tmp = document.createElement("canvas");
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  let done = 1;
  while (done <= total) {
    const step = Math.min(done, total + 1 - done);
    tctx.clearRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(canvas, 0, 0);
    ctx.drawImage(tmp, step, step);
    done += step;
  }
}
