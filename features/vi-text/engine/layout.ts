// Layout maths: everything is computed in "measure units" (main title at a
// 500px font size) and later scaled to canvas pixels by the renderer.
import { CANVAS_MARGIN, FONT_PRICEDOWN, FONT_SCRIPT, FONT_TITLE, KERNING, LINE_PAD, MEASURE_SIZE } from "./config";
import { measureRuns, setFont } from "./canvasText";
import { pricedownRuns, type FontRun } from "./text";

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------ main lines -- */

export interface TitleRun {
  font: string;
  text: string;
  advance: number;
  kernBefore: number;
}

export interface LineMeasure {
  lineW: number;
  lineH: number;
  ascent: number;
  descent: number;
  visualAscent: number;
  visualDescent: number;
  runs: TitleRun[];
}

/** Height of a capital H in the title face at the measure size. */
export function titleCapHeight(ctx: Ctx | null): number {
  if (!ctx) return 360;
  setFont(ctx, MEASURE_SIZE, FONT_TITLE, 0);
  return ctx.measureText("H").actualBoundingBoxAscent || 360;
}

function pairKern(prev: string, next: string): number {
  return KERNING[prev + next] ?? 0;
}

/**
 * Measures one main-title line. The line is grouped into runs by font (today a
 * single title-font run), with pair kerning applied between runs.
 */
export function measureTitleLine(ctx: Ctx | null, line: string): LineMeasure {
  const empty: LineMeasure = { lineW: 0, lineH: 0, ascent: 0, descent: 0, visualAscent: 0, visualDescent: 0, runs: [] };
  if (!line) return empty;
  if (!ctx) return { ...empty, lineH: 1 };

  const groups: { font: string; text: string }[] = [];
  let current = { font: FONT_TITLE as string, text: line[0] };
  for (let i = 1; i < line.length; i++) {
    if (current.font === FONT_TITLE) current.text += line[i];
    else {
      groups.push(current);
      current = { font: FONT_TITLE, text: line[i] };
    }
  }
  groups.push(current);

  const letterSpacing = -0;
  const runs: TitleRun[] = [];
  let width = 0;
  let ascent = 0;
  let descent = 0;
  let visualAscent = 0;
  let visualDescent = 0;
  groups.forEach((group, i) => {
    setFont(ctx, MEASURE_SIZE, group.font, letterSpacing);
    const m = ctx.measureText(group.text);
    let kern = 0;
    if (i > 0) {
      const prev = groups[i - 1];
      kern = (pairKern(prev.text[prev.text.length - 1], group.text[0]) / 1000) * MEASURE_SIZE;
    }
    runs.push({ ...group, advance: m.width, kernBefore: kern });
    width += m.width + kern;
    ascent = Math.max(ascent, m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? 0);
    descent = Math.max(descent, m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? 0);
    visualAscent = Math.max(visualAscent, m.actualBoundingBoxAscent ?? 0);
    visualDescent = Math.max(visualDescent, m.actualBoundingBoxDescent ?? 0);
  });
  return {
    lineW: Math.max(0, width - letterSpacing),
    lineH: ascent + descent || 1,
    ascent: ascent || 400,
    descent: descent || 100,
    visualAscent: visualAscent || ascent,
    visualDescent,
    runs,
  };
}

/* ---------------------------------------------------- auto line spacing -- */

const lineStepCache = new Map<string, number[]>();
let capRatioCache: number | null = null;

/** Called once custom fonts finish loading: cached pixel scans are stale. */
export function resetLayoutCaches(): void {
  lineStepCache.clear();
  capRatioCache = null;
}

/** Most common cap-height / font-size ratio across A-Z0-9 in Pricedown. */
function pricedownCapRatio(ctx: Ctx, size: number): number {
  if (capRatioCache !== null) return capRatioCache;
  setFont(ctx, size, FONT_PRICEDOWN, 0);
  const counts = new Map<number, number>();
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
    const a = ctx.measureText(ch).actualBoundingBoxAscent;
    if (!a || !Number.isFinite(a)) continue;
    const key = Math.round((a / size) * 1000);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [k, n] of counts) {
    if (n > bestCount || (n === bestCount && k > best)) {
      best = k;
      bestCount = n;
    }
  }
  return (capRatioCache = bestCount > 0 ? best / 1000 : Infinity);
}

interface InkProfile {
  bottom: (number | null)[];
  top: (number | null)[];
  hook: (number | null)[];
}

interface ScanFrame {
  scale: number;
  originX: number;
  baselineY: number;
  width: number;
  height: number;
}

function renderAlpha(ctx: Ctx, frame: ScanFrame, runs: FontRun[], x: number, size: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, frame.width, frame.height);
  ctx.fillStyle = "#fff";
  let pen = x;
  for (const run of runs) {
    setFont(ctx, size, run.family, 0);
    ctx.fillText(run.text, pen, frame.baselineY);
    pen += ctx.measureText(run.text).width;
  }
  try {
    return ctx.getImageData(0, 0, frame.width, frame.height).data;
  } catch {
    return null;
  }
}

/** Scans a rendered line column by column for its top/bottom ink (and the R-hook ink). */
function scanLine(
  ctx: Ctx,
  frame: ScanFrame,
  runs: FontRun[],
  plainRuns: FontRun[],
  line: string,
  x: number,
  size: number,
): InkProfile | null {
  if (!line.trim()) return null;
  const ink = renderAlpha(ctx, frame, runs, x, size);
  if (!ink) return null;
  const plain = runs.some((r) => r.family !== FONT_PRICEDOWN) ? renderAlpha(ctx, frame, plainRuns, x, size) : null;
  const bottom: (number | null)[] = Array(frame.width).fill(null);
  const top: (number | null)[] = Array(frame.width).fill(null);
  const hook: (number | null)[] = Array(frame.width).fill(null);
  for (let row = 0; row < frame.height; row++) {
    const rowStart = row * frame.width;
    for (let col = 0; col < frame.width; col++) {
      const a = (rowStart + col) * 4 + 3;
      if (ink[a] < 24) continue;
      const y = (row - frame.baselineY) / frame.scale;
      if (top[col] === null) top[col] = y;
      bottom[col] = y;
      if (plain !== null && plain[a] < 24) hook[col] = y;
    }
  }
  return { bottom, top, hook };
}

/**
 * Computes the baseline-to-baseline step (in cap heights) for each pair of
 * stacked Pricedown lines so they sit as tight as their actual ink allows,
 * keeping `gap` (in cap heights) between them. Clamped to 0.62..1.8.
 */
function computeAutoLineSteps(lines: string[], interlock: boolean, capRatio: number, gap: number): number[] {
  const fallback = () => lines.slice(1).map(() => 0.62);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback();
  const size = 128 / (capRatio || 0.72);
  const runs = lines.map((l) => pricedownRuns(l, interlock));
  const plainRuns = lines.map((l) => pricedownRuns(l, false));
  const widths = runs.map((r) => measureRuns(ctx, r, size).width);
  const maxW = Math.max(...widths);
  if (!Number.isFinite(maxW) || maxW <= 0) return fallback();
  const pad = Math.ceil(size);
  const frame: ScanFrame = {
    scale: size,
    originX: pad,
    baselineY: pad + Math.ceil(size),
    width: Math.ceil(maxW) + 2 * pad,
    height: Math.ceil(3 * size),
  };
  if (frame.width > 8192 || frame.height > 8192) return fallback();
  canvas.width = frame.width;
  canvas.height = frame.height;
  const profiles = lines.map((line, i) =>
    scanLine(ctx, frame, runs[i], plainRuns[i], line, frame.originX + (maxW - widths[i]) / 2, size),
  );
  const capLimit = -(pricedownCapRatio(ctx, size) + 0.02);
  const cap = capRatio || 0.72;
  return lines.slice(1).map((_, i) => {
    const upper = profiles[i];
    const lower = profiles[i + 1];
    if (!upper || !lower) return 0.62;
    let needed = -Infinity;
    let overlap = false;
    for (let col = 0; col < frame.width; col++) {
      const b = upper.bottom[col];
      const t = lower.top[col];
      if (b === null || t === null) continue;
      overlap = true;
      // Under an interlocking R hook, accented capitals may tuck in tighter.
      const g = (upper.hook[col] !== null && t < capLimit ? Math.min(0.035, gap) : gap) * cap;
      if (b - t + g > needed) needed = b - t + g;
    }
    return overlap ? Math.min(1.8, Math.max(0.62, needed / cap)) : 0.62;
  });
}

function autoLineSteps(lines: string[], interlock: boolean, capRatio: number, gap = 0.06): number[] {
  if (lines.length < 2) return [];
  const key = `${interlock ? "ss01" : "plain"}|${capRatio.toFixed(4)}|${gap.toFixed(4)}|${lines.join(" ")}`;
  const cached = lineStepCache.get(key);
  if (cached) return cached;
  const steps = computeAutoLineSteps(lines, interlock, capRatio, gap);
  if (lineStepCache.size >= 64) {
    const oldest = lineStepCache.keys().next().value;
    if (oldest !== undefined) lineStepCache.delete(oldest);
  }
  lineStepCache.set(key, steps);
  return steps;
}

/* -------------------------------------------------- Pricedown layer block -- */

export interface LayerBlock {
  fontNatural: number;
  runs: FontRun[][];
  widths: number[];
  capH: number;
  lineSteps: number[];
  pad: number;
  capBandH: number;
  inkH: number;
  blockW: number;
  blockH: number;
}

export interface LayerBlockOptions {
  lines: string[];
  /** Cap height as % of the title's cap height. */
  sizePct: number;
  /** Padding around the block, in font sizes. */
  padFactor: number;
  extraGap: number;
  autoStep: boolean;
  /** Ink gap for auto spacing, in font sizes (defaults to 0.06 cap heights). */
  inkGap?: number;
  interlock: boolean;
  manualStep: number;
}

export function layoutLayerBlock(ctx: Ctx | null, o: LayerBlockOptions): LayerBlock | null {
  if (o.lines.length === 0 || !ctx) return null;
  const runs = o.lines.map((l) => pricedownRuns(l, o.interlock));
  setFont(ctx, 100, FONT_PRICEDOWN, 0);
  const capRatio = (ctx.measureText("H").actualBoundingBoxAscent || 72) / 100;
  const capH = titleCapHeight(ctx) * (o.sizePct / 100);
  const fontSize = capH / capRatio;
  let maxW = 0;
  let maxDescent = 0;
  let maxOverhang = 0;
  const widths = runs.map((r) => {
    const m = measureRuns(ctx, r, fontSize);
    maxW = Math.max(maxW, m.width);
    maxDescent = Math.max(maxDescent, m.descent);
    maxOverhang = Math.max(maxOverhang, m.overhang);
    return m.width;
  });
  const gaps = Math.max(0, o.lines.length - 1);
  const stepFactors = o.autoStep
    ? autoLineSteps(o.lines, o.interlock, capRatio, o.inkGap !== undefined ? o.inkGap / capRatio : undefined)
    : Array(gaps).fill(o.manualStep);
  const lineSteps = Array.from({ length: gaps }, (_, i) => capH * (stepFactors[i] ?? o.manualStep) + fontSize * o.extraGap);
  const pad = fontSize * o.padFactor;
  const capBandH = lineSteps.reduce((a, b) => a + b, 0) + capH;
  const inkH = capBandH + maxDescent;
  return {
    fontNatural: fontSize,
    runs,
    widths,
    capH,
    lineSteps,
    pad,
    capBandH,
    inkH,
    blockW: maxW + 2 * pad + 2 * maxOverhang,
    blockH: inkH + 2 * pad,
  };
}

/** Average side bearing of solid capitals, used as the 3D style's ink padding. */
export function pricedownSideBearing(ctx: Ctx): number {
  setFont(ctx, 100, FONT_PRICEDOWN, 0);
  let sum = 0;
  let n = 0;
  for (const ch of "HNIEMUBD") {
    const m = ctx.measureText(ch);
    const ink = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? m.width);
    if (m.width > 0 && ink > 0) {
      sum += m.width - ink;
      n++;
    }
  }
  return n ? Math.max(0, sum / n) / 100 : 0.05;
}

/* ----------------------------------------------------------- script text -- */

export interface ScriptLayout {
  fontNatural: number;
  widths: number[];
  baselines: number[];
  shear: number;
  depth: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Lays out the Damion script that sits sheared across the 3D title. */
export function layoutScript(ctx: Ctx | null, lines: string[], sizePct: number, block: LayerBlock, depth: number): ScriptLayout | null {
  if (lines.length === 0 || !ctx) return null;
  setFont(ctx, 100, FONT_SCRIPT, 0);
  const capRatio = (ctx.measureText("H").actualBoundingBoxAscent || 70) / 100;
  const capH = block.capH * (sizePct / 100);
  const fontSize = capH / capRatio;
  const lineStep = 0.95 * fontSize;
  const firstBaseline = -(capH + lineStep * (lines.length - 1)) / 2 + capH;
  const outline = 0.05 * fontSize;
  const shadowDepth = 0.6 * depth;
  setFont(ctx, fontSize, FONT_SCRIPT, 0);
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  const widths: number[] = [];
  const baselines: number[] = [];
  lines.forEach((line, i) => {
    const m = ctx.measureText(line);
    const base = firstBaseline + lineStep * i;
    widths.push(m.width);
    baselines.push(base);
    if (!line) return;
    left = Math.min(left, -m.width / 2 - (m.actualBoundingBoxLeft ?? 0));
    right = Math.max(right, -m.width / 2 + (m.actualBoundingBoxRight ?? m.width));
    top = Math.min(top, base - (m.actualBoundingBoxAscent ?? capH));
    bottom = Math.max(bottom, base + (m.actualBoundingBoxDescent ?? 0));
  });
  const span = right - left;
  const maxShear = Math.tan((10 * Math.PI) / 180);
  const shear = span > 0 ? Math.min(maxShear, (0.5 * block.capH) / span) : maxShear;
  const reach = outline * Math.sqrt(1 + shear * shear);
  return {
    fontNatural: fontSize,
    widths,
    baselines,
    shear,
    depth: shadowDepth,
    left: left - reach,
    right: right + reach + shadowDepth,
    top: top - right * shear - reach,
    bottom: bottom - left * shear + reach + shadowDepth,
  };
}

/* ----------------------------------------------------------- composition -- */

export interface Composition {
  totalW: number;
  totalH: number;
  lineH: number;
  lineGap: number;
  lineMeasures: LineMeasure[];
  overlay: LayerBlock | null;
  extrude: LayerBlock | null;
  extrudeDepth: number;
  extrudeX: number;
  script: ScriptLayout | null;
  scriptX: number;
  scriptY: number;
  mainOffsetY: number;
  overlayInkTop: number;
  inkTop: number;
  inkBottom: number;
}

export interface CompositionInput {
  ctx: Ctx | null;
  mainLines: string[];
  overlay: LayerBlock | null;
  extrude: LayerBlock | null;
  scriptLines: string[];
  scriptSize: number;
}

export function layoutComposition({ ctx, mainLines, overlay, extrude, scriptLines, scriptSize }: CompositionInput): Composition {
  const lines = extrude ? [] : mainLines.map((l) => measureTitleLine(ctx, l));
  const maxLineW = lines.reduce((m, l) => Math.max(m, l.lineW), 0);
  const base: Composition = {
    totalW: 0,
    totalH: 0,
    lineH: 0,
    lineGap: 0,
    lineMeasures: lines,
    overlay,
    extrude: null,
    extrudeDepth: 0,
    extrudeX: 0,
    script: null,
    scriptX: 0,
    scriptY: 0,
    mainOffsetY: 0,
    overlayInkTop: 0,
    inkTop: 0,
    inkBottom: 0,
  };

  if (extrude) {
    const depth = 0.085 * extrude.fontNatural;
    const w = extrude.blockW + depth;
    const h = extrude.blockH + depth;
    const script = layoutScript(ctx, scriptLines, scriptSize, extrude, depth);
    const centerX = extrude.blockW / 2;
    const scriptBase = extrude.pad + extrude.capH + extrude.lineSteps.reduce((a, b) => a + b, 0);
    const left = Math.min(0, script ? centerX + script.left : 0);
    const right = Math.max(w, script ? centerX + script.right : 0);
    const top = Math.min(0, script ? scriptBase + script.top : 0);
    const height = Math.max(h, script ? scriptBase + script.bottom : 0) - top;
    return {
      ...base,
      totalW: right - left,
      totalH: height,
      extrude,
      extrudeDepth: depth,
      extrudeX: -left,
      overlayInkTop: -top + extrude.pad,
      script,
      scriptX: centerX - left,
      scriptY: scriptBase - top,
      inkTop: 0,
      inkBottom: height,
    };
  }

  if (maxLineW === 0 && !overlay) return base;

  const lineH = maxLineW === 0 ? 0 : lines.reduce((m, l) => Math.max(m, l.lineH), 0) || 1;
  const lineGap = Math.round(-0.4 * lineH);
  const mainW = maxLineW === 0 ? 0 : maxLineW + 2 * LINE_PAD;
  const mainH = maxLineW === 0 ? 0 : (lineH + 2 * LINE_PAD) * lines.length + lineGap * Math.max(0, lines.length - 1);
  const capH = titleCapHeight(ctx);
  const firstBaseline = LINE_PAD + lines.reduce((m, l) => Math.max(m, l.ascent), 0);
  const lastBaseline = firstBaseline + (lines.length - 1) * (lineH + 2 * LINE_PAD + lineGap);

  if (!overlay) {
    return { ...base, totalW: mainW, totalH: mainH, lineH, lineGap, inkTop: firstBaseline - capH, inkBottom: lastBaseline };
  }
  if (maxLineW === 0) {
    return {
      ...base,
      totalW: overlay.blockW,
      totalH: overlay.blockH,
      lineH,
      lineGap,
      overlayInkTop: overlay.pad,
      inkTop: overlay.pad,
      inkBottom: overlay.pad + overlay.inkH,
    };
  }
  // Centre the overlay's cap band on the main title's cap band.
  const overlayTop = (firstBaseline - capH + lastBaseline) / 2 - overlay.capBandH / 2;
  const blockTop = overlayTop - overlay.pad;
  const blockBottom = overlayTop + overlay.inkH + overlay.pad;
  const growTop = Math.max(0, -blockTop);
  const growBottom = Math.max(0, blockBottom - mainH);
  return {
    ...base,
    totalW: Math.max(mainW, overlay.blockW),
    totalH: mainH + growTop + growBottom,
    lineH,
    lineGap,
    mainOffsetY: growTop,
    overlayInkTop: growTop + overlayTop,
    inkTop: growTop + firstBaseline - capH,
    inkBottom: growTop + lastBaseline,
  };
}

/* ----------------------------------------------------------- canvas plan -- */

export interface CanvasPlan extends Composition {
  canvasW: number;
  canvasH: number;
  textX: number;
  textY: number;
  textScale: number;
}

/**
 * Sizes the output canvas. Normally the composition gets an 80px margin with
 * the vertical margins balanced so the cap band is optically centred. With
 * "Use full background" the canvas is the image's native size and the text is
 * scaled down (never up) to fit inside an 80px inset.
 */
export function planCanvas(comp: Composition, fullBackgroundImage: HTMLImageElement | null): CanvasPlan {
  const { totalW, totalH, inkTop, inkBottom } = comp;
  if (!totalW || !totalH) return { ...comp, canvasW: 0, canvasH: 0, textX: 0, textY: 0, textScale: 1 };
  const above = Math.max(0, inkTop);
  const below = Math.max(0, totalH - inkBottom);
  const top = CANVAS_MARGIN + Math.max(0, below - above);
  const bottom = CANVAS_MARGIN + Math.max(0, above - below);
  const img = fullBackgroundImage;
  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, Math.max(1, w - 2 * CANVAS_MARGIN) / totalW, Math.max(1, h - 2 * CANVAS_MARGIN) / totalH);
    const scaledH = totalH * scale;
    const slack = Math.max(0, (h - scaledH) / 2);
    return {
      ...comp,
      canvasW: w,
      canvasH: h,
      textX: (w - totalW * scale) / 2,
      textY: (h - scaledH) / 2 + Math.max(-slack, Math.min(slack, ((below - above) / 2) * scale)),
      textScale: scale,
    };
  }
  return { ...comp, canvasW: totalW + 2 * CANVAS_MARGIN, canvasH: totalH + top + bottom, textX: CANVAS_MARGIN, textY: top, textScale: 1 };
}
