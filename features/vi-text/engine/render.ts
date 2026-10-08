// Draws a CanvasPlan into a canvas at a given pixel scale.
import {
  BACKGROUNDS,
  DARK_OUTLINE,
  EXTRUDE_COLOR,
  FILL_GRADIENT,
  FONT_SCRIPT,
  HIGHLIGHT_GRADIENT,
  INLINE_GRADIENT,
  LINE_PAD,
  MEASURE_SIZE,
  OUTLINE_GRADIENT,
  SCRIPT_OUTLINE,
  SOLID_BACKGROUND,
  isColorStyle,
  miterLimitFor,
  type BackgroundMode,
  type ColorStop,
  type StyleKey,
} from "./config";
import { drawRuns, extrudeCanvas, setFont } from "./canvasText";
import type { CanvasPlan, TitleRun } from "./layout";

type Ctx = CanvasRenderingContext2D;

export interface RenderInput {
  plan: CanvasPlan;
  style: StyleKey;
  whiteInline: boolean;
  /** Filtered lines, used to skip empty overlay / extrude / script lines. */
  overlayLines: string[];
  extrudeLines: string[];
  scriptLines: string[];
  /** Title cap height in measure units. */
  capHeight: number;
  textureColor: HTMLImageElement | null;
  textureMono: HTMLImageElement | null;
  background: { mode: BackgroundMode; image: HTMLImageElement | null } | null;
}

/** Texture scaled to the band height, cached per source + height. */
export interface TextureCache {
  color: { key: string; canvas: HTMLCanvasElement } | null;
  mono: { key: string; canvas: HTMLCanvasElement } | null;
}

export function createTextureCache(): TextureCache {
  return { color: null, mono: null };
}

function scaledTexture(img: HTMLImageElement | null, height: number, slot: "color" | "mono", cache: TextureCache) {
  if (!img || !(img.naturalWidth > 0 && img.naturalHeight > 0)) return null;
  const key = `${img.src}|h=${height}`;
  const hit = cache[slot];
  if (hit && hit.key === key) return hit.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((img.naturalWidth * height) / img.naturalHeight));
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, height);
  cache[slot] = { key, canvas };
  return canvas;
}

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Background: solid colour, or the image scaled to cover and centred. */
export function drawBackground(ctx: Ctx, w: number, h: number, mode: BackgroundMode, image: HTMLImageElement | null) {
  if (mode === "color") {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = SOLID_BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }
  if (mode !== "image" || !image || !image.naturalWidth || !image.naturalHeight) return;
  const s = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const iw = Math.max(1, Math.round(image.naturalWidth * s));
  const ih = Math.max(1, Math.round(image.naturalHeight * s));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, Math.floor((w - iw) / 2), Math.floor((h - ih) / 2), iw, ih);
  ctx.restore();
}

export { BACKGROUNDS };

/**
 * Renders the composition. `scale` maps composition pixels to canvas pixels
 * (preview fit × devicePixelRatio, or 1 for export). Returns false when there
 * is nothing to draw (the canvas is then reset to 1×1).
 */
export function renderComposition(canvas: HTMLCanvasElement, scale: number, input: RenderInput, cache: TextureCache): boolean {
  const { plan, style, whiteInline } = input;
  const {
    totalW,
    totalH,
    lineH,
    lineGap,
    lineMeasures,
    overlay,
    extrude,
    extrudeX,
    script,
    scriptX,
    scriptY,
    mainOffsetY,
    overlayInkTop,
    canvasW,
    canvasH,
    textX,
    textY,
    textScale,
  } = plan;
  if (!totalW || !totalH || (lineMeasures.length === 0 && !extrude)) {
    canvas.width = 1;
    canvas.height = 1;
    return false;
  }
  const W = Math.max(1, Math.round(canvasW * scale));
  const H = Math.max(1, Math.round(canvasH * scale));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.clearRect(0, 0, W, H);
  if (input.background) drawBackground(ctx, W, H, input.background.mode, input.background.image);

  const k = textScale * scale; // measure units -> canvas px
  const fontPx = MEASURE_SIZE * k;
  const bandH = Math.max(1, Math.round(lineH * k));
  const maxVisualAscent = lineMeasures.reduce((m, l) => Math.max(m, l.visualAscent), 0);
  const textureH = Math.max(
    1,
    Math.round((maxVisualAscent + lineMeasures.reduce((m, l) => Math.max(m, l.visualDescent), 0) || lineH) * k * 1),
  );
  const capH = input.capHeight;
  const palmColor = scaledTexture(input.textureColor, textureH, "color", cache);
  const palmMono = scaledTexture(input.textureMono, textureH, "mono", cache);
  const letterSpacing = -0 * fontPx;

  const vGradient = (top: number, bottom: number, stops: readonly ColorStop[]) => {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    for (const s of stops) g.addColorStop(s.stop, s.color);
    return g;
  };
  const drawTitle = (c: Ctx, runs: TitleRun[], x: number, y: number, mode: "fill" | "stroke") => {
    let pen = x;
    runs.forEach((run, i) => {
      if (i > 0) pen += run.kernBefore * k;
      setFont(c, fontPx, run.font, letterSpacing);
      if (mode === "fill") c.fillText(run.text, pen, y);
      else c.strokeText(run.text, pen, y);
      pen += run.advance * k;
    });
  };
  const strokeTitle = (c: Ctx, runs: TitleRun[], x: number, y: number, width: number, miterUnits: number, style: string | CanvasGradient) => {
    c.save();
    c.lineJoin = "miter";
    c.miterLimit = miterLimitFor(miterUnits);
    c.lineCap = "butt";
    c.lineWidth = width * k;
    c.strokeStyle = style;
    drawTitle(c, runs, x, y, "stroke");
    c.restore();
  };
  /** Paints the palm band (repeat-x) covering one line's cap band. */
  const fillPalmBand = (c: Ctx, texture: HTMLCanvasElement, baseline: number, visualDescent: number, capTop: number) => {
    const pattern = c.createPattern(texture, "repeat-x");
    if (!pattern) return false;
    const bandTop = Math.round(baseline + visualDescent * k) - textureH;
    c.save();
    c.translate(0, bandTop);
    c.fillStyle = pattern;
    c.fillRect(0, Math.round(capTop) - bandTop, W, bandH);
    c.restore();
    return true;
  };

  /* ---------------------------------------------------- main title lines */
  lineMeasures.forEach((line, i) => {
    if (!line.runs.length) return;
    const { lineW, ascent, runs } = line;
    const x = (textX + (LINE_PAD + (totalW - 2 * LINE_PAD - lineW) / 2) * textScale) * scale;
    const y = (textY + (mainOffsetY + i * (lineH + 2 * LINE_PAD + lineGap)) * textScale + (LINE_PAD + ascent) * textScale) * scale;
    const lineTop = y - ascent * k;

    if (isColorStyle(style)) {
      const capTop = y - capH * k;
      if (whiteInline) strokeTitle(ctx, runs, x, y, 42, 21, DARK_OUTLINE);
      strokeTitle(ctx, runs, x, y, 28, 14, vGradient(capTop, y, OUTLINE_GRADIENT));
      strokeTitle(ctx, runs, x, y, 12, 6, whiteInline ? "#ffffff" : vGradient(capTop, y, INLINE_GRADIENT));
      ctx.save();
      ctx.fillStyle = vGradient(capTop, y, FILL_GRADIENT);
      drawTitle(ctx, runs, x, y, "fill");
      ctx.restore();

      // Palm silhouettes, soft-light blended into the fill only.
      if (palmColor) {
        const mask = newCanvas(W, H);
        const mctx = mask.getContext("2d");
        if (mctx) {
          mctx.fillStyle = "#fff";
          drawTitle(mctx, runs, x, y, "fill");
          const band = newCanvas(W, H);
          const bctx = band.getContext("2d")!;
          if (fillPalmBand(bctx, palmColor, y, line.visualDescent, lineTop)) {
            bctx.globalCompositeOperation = "destination-in";
            bctx.drawImage(mask, 0, 0);
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "soft-light";
            ctx.drawImage(band, 0, 0);
            ctx.restore();
          }
        }
      }

      // Warm sun highlight in each glyph's bottom-left corner.
      const glow = newCanvas(W, H);
      const gctx = glow.getContext("2d");
      const scratch = newCanvas(W, H);
      const sctx = scratch.getContext("2d");
      if (gctx && sctx) {
        const angle = (62 * Math.PI) / 180;
        const dx = Math.cos(angle);
        const dy = -Math.sin(angle);
        const reach = capH * k * 1;
        let pen = x;
        runs.forEach((run, ri) => {
          if (ri > 0) pen += run.kernBefore * k;
          setFont(gctx, fontPx, run.font, letterSpacing);
          setFont(sctx, fontPx, run.font, letterSpacing);
          const chars = Array.from(run.text);
          let prevW = 0;
          chars.forEach((ch, ci) => {
            const upTo = gctx.measureText(chars.slice(0, ci + 1).join("")).width;
            const adv = upTo - prevW;
            prevW = upTo;
            if (ch === " " || adv <= 0) return;
            const m = gctx.measureText(ch);
            const gx = pen + upTo - m.width;
            const left = gx - (m.actualBoundingBoxLeft ?? 0);
            const right = gx + (m.actualBoundingBoxRight ?? m.width);
            const bottom = y + (m.actualBoundingBoxDescent ?? 0);
            const grad = sctx.createLinearGradient(left, bottom, left + dx * reach, bottom + dy * reach);
            for (const s of HIGHLIGHT_GRADIENT) grad.addColorStop(s.stop, s.color);
            sctx.globalCompositeOperation = "source-over";
            sctx.clearRect(0, 0, W, H);
            sctx.fillStyle = grad;
            sctx.fillRect(Math.floor(left), 0, Math.ceil(right - left), H);
            sctx.globalCompositeOperation = "destination-in";
            sctx.fillStyle = "#fff";
            sctx.fillText(ch, gx, y);
            gctx.drawImage(scratch, 0, 0);
          });
          pen += run.advance * k;
        });
        ctx.drawImage(glow, 0, 0);
      }
    } else {
      // Mono: white outline ring with a transparent gap, white fill, palms punched out.
      const layer = newCanvas(W, H);
      const lctx = layer.getContext("2d");
      if (!lctx) return;
      strokeTitle(lctx, runs, x, y, 28, 14, "#ffffff");
      lctx.save();
      lctx.globalCompositeOperation = "destination-out";
      lctx.lineJoin = "miter";
      lctx.miterLimit = miterLimitFor(7);
      lctx.lineCap = "butt";
      lctx.lineWidth = 14 * k;
      lctx.strokeStyle = "#000";
      drawTitle(lctx, runs, x, y, "stroke");
      lctx.restore();
      lctx.save();
      lctx.fillStyle = "#ffffff";
      drawTitle(lctx, runs, x, y, "fill");
      lctx.restore();
      if (palmMono) {
        const band = newCanvas(W, H);
        const bctx = band.getContext("2d");
        if (bctx && fillPalmBand(bctx, palmMono, y, line.visualDescent, lineTop)) {
          const mask = newCanvas(W, H);
          const mctx = mask.getContext("2d")!;
          mctx.fillStyle = "#fff";
          drawTitle(mctx, runs, x, y, "fill");
          bctx.globalCompositeOperation = "destination-in";
          bctx.drawImage(mask, 0, 0);
          lctx.globalCompositeOperation = "destination-out";
          lctx.drawImage(band, 0, 0);
        }
      }
      ctx.drawImage(layer, 0, 0);
    }
  });

  /* ------------------------------------------------------ overlay layer */
  if (overlay) {
    const { fontNatural, runs, widths, capH: oCap, lineSteps, inkH } = overlay;
    const offsets = lineSteps.reduce<number[]>((acc, s) => [...acc, acc[acc.length - 1] + s], [0]);
    const size = fontNatural * k;
    const inner = 0.055 * fontNatural * k;
    const top = textY + overlayInkTop * textScale;
    const baseline = (i: number) => (top + (oCap + (offsets[i] ?? 0)) * textScale) * scale;
    const left = (i: number) => (textX + ((totalW - widths[i]) / 2) * textScale) * scale;
    ctx.save();
    ctx.lineJoin = "miter";
    ctx.miterLimit = 3.9;
    ctx.lineCap = "butt";
    const a = (45 * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const cx = (textX + (totalW / 2) * textScale) * scale;
    const cy = (top + (inkH / 2) * textScale) * scale;
    const len = Math.abs(Math.max(...widths) * k * sin) + Math.abs(inkH * k * cos);
    const outer = ctx.createLinearGradient(cx - (sin * len) / 2, cy - (cos * len) / 2, cx + (sin * len) / 2, cy + (cos * len) / 2);
    for (const s of INLINE_GRADIENT) outer.addColorStop(s.stop, s.color);
    ctx.lineWidth = 2 * (0.018 * fontNatural * k + inner);
    ctx.strokeStyle = outer;
    input.overlayLines.forEach((l, i) => l && drawRuns(ctx, runs[i], size, left(i), baseline(i), "stroke", 0));
    ctx.lineWidth = 2 * inner;
    ctx.strokeStyle = DARK_OUTLINE;
    input.overlayLines.forEach((l, i) => l && drawRuns(ctx, runs[i], size, left(i), baseline(i), "stroke", 1));
    ctx.fillStyle = "#ffffff";
    input.overlayLines.forEach((l, i) => l && drawRuns(ctx, runs[i], size, left(i), baseline(i), "fill"));
    ctx.restore();
  }

  /* ------------------------------------------------- 3D extrude + script */
  if (extrude) {
    const { fontNatural, runs, widths, capH: eCap, lineSteps } = extrude;
    const offsets = lineSteps.reduce<number[]>((acc, s) => [...acc, acc[acc.length - 1] + s], [0]);
    const size = fontNatural * k;
    const top = textY + overlayInkTop * textScale;
    const baseline = (i: number) => (top + (eCap + (offsets[i] ?? 0)) * textScale) * scale;
    const left = (i: number) => (textX + (extrudeX + (extrude.blockW - widths[i]) / 2) * textScale) * scale;

    const shadow = newCanvas(W, H);
    const shctx = shadow.getContext("2d");
    if (shctx) {
      shctx.lineJoin = "round";
      shctx.lineCap = "round";
      shctx.lineWidth = 0.045 * fontNatural * k * 2;
      shctx.strokeStyle = EXTRUDE_COLOR;
      shctx.fillStyle = EXTRUDE_COLOR;
      input.extrudeLines.forEach((l, i) => {
        if (!l) return;
        drawRuns(shctx, runs[i], size, left(i), baseline(i), "stroke");
        drawRuns(shctx, runs[i], size, left(i), baseline(i), "fill");
      });
      extrudeCanvas(shadow, plan.extrudeDepth * k);
      ctx.drawImage(shadow, 0, 0);
    }
    ctx.save();
    ctx.fillStyle = "#ffffff";
    input.extrudeLines.forEach((l, i) => l && drawRuns(ctx, runs[i], size, left(i), baseline(i), "fill"));
    ctx.restore();

    if (script) {
      const sSize = script.fontNatural * k;
      const outline = 0.032 * script.fontNatural * k;
      const sx = (i: number) => (textX + (scriptX - script.widths[i] / 2) * textScale) * scale;
      const sy = (i: number) => (textY + (scriptY + script.baselines[i]) * textScale) * scale;
      const ox = (textX + scriptX * textScale) * scale;
      const oy = (textY + scriptY * textScale) * scale;
      const drawScript = (c: Ctx, mode: "fill" | "stroke") => {
        c.save();
        c.translate(ox, oy);
        c.transform(1, -script.shear, 0, 1, 0, 0);
        c.translate(-ox, -oy);
        setFont(c, sSize, FONT_SCRIPT, 0);
        input.scriptLines.forEach((l, i) => {
          if (!l) return;
          if (mode === "fill") c.fillText(l, sx(i), sy(i));
          else c.strokeText(l, sx(i), sy(i));
        });
        c.restore();
      };
      const sShadow = newCanvas(W, H);
      const ssctx = sShadow.getContext("2d");
      if (ssctx) {
        ssctx.lineJoin = "round";
        ssctx.lineCap = "round";
        ssctx.lineWidth = 2 * (outline + 0.018 * script.fontNatural * k);
        ssctx.strokeStyle = EXTRUDE_COLOR;
        ssctx.fillStyle = EXTRUDE_COLOR;
        drawScript(ssctx, "stroke");
        drawScript(ssctx, "fill");
        extrudeCanvas(sShadow, script.depth * k);
        ctx.drawImage(sShadow, 0, 0);
      }
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 2 * outline;
      ctx.strokeStyle = SCRIPT_OUTLINE;
      drawScript(ctx, "stroke");
      ctx.fillStyle = "#ffffff";
      drawScript(ctx, "fill");
      ctx.restore();
    }
  }
  return true;
}
