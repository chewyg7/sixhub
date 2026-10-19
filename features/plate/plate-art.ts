/**
 * The Leonida plate, drawn on a canvas: the face (colours, type, oranges) and
 * a matching height map that makes the stamped parts (characters, rim) stand
 * up under 3D lighting. Proportions follow a real 12" × 6" US plate and the
 * official GTA VI Leonida plate.
 */

export const PLATE_W = 2048;
export const PLATE_H = 1024;
export const MAX_CHARS = 8;

export interface PlateStyle {
  id: string;
  name: string;
  /** Background: one colour, or top → bottom gradient. */
  bg: [string, string];
  /** Stamped characters. */
  text: string;
  /** "LEONIDA" and "GOODTIME STATE". */
  print: string;
  /** Faint wash over the oranges so they sit "in" the sheeting. */
  orangeAlpha: number;
  /** Swatch for the picker. */
  swatch: [string, string];
}

export const STYLES: PlateStyle[] = [
  { id: "goodtime", name: "Goodtime State", bg: ["#fbfbf8", "#ecebe6"], text: "#239b98", print: "#1d918e", orangeAlpha: 1, swatch: ["#ffffff", "#1d9592"] },
  { id: "midnight", name: "Midnight", bg: ["#16191b", "#0b0d0e"], text: "#5fd6cb", print: "#49c2b8", orangeAlpha: 0.95, swatch: ["#111416", "#5fd6cb"] },
  { id: "sunset", name: "Vice Sunset", bg: ["#ffd9c4", "#ff9bb3"], text: "#253558", print: "#2c3e66", orangeAlpha: 0.95, swatch: ["#ffb6b9", "#253558"] },
  { id: "keys", name: "Leonida Keys", bg: ["#eefcf9", "#bfeee6"], text: "#0f5d66", print: "#127079", orangeAlpha: 1, swatch: ["#cff3ee", "#0f5d66"] },
  { id: "heritage", name: "Heritage", bg: ["#f5ebd3", "#e7d6b0"], text: "#2f5a3b", print: "#355f42", orangeAlpha: 0.9, swatch: ["#efe2c2", "#2f5a3b"] },
];

export type FrameKind = "none" | "chrome" | "black" | "gold";

/** Letters and digits only, upper case, like the real thing. */
export const cleanPlateText = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_CHARS);

/* ---------- Assets ---------- */

const FONT = { leonida: "PlateLeonida", goodtime: "PlateGoodtime", number: "PlateNumber" } as const;
let assets: Promise<HTMLImageElement> | null = null;

/** Loads the three plate fonts and the oranges once. Resolves with the oranges image. */
export function loadPlateAssets(): Promise<HTMLImageElement> {
  if (assets) return assets;
  const fonts = [
    new FontFace(FONT.leonida, "url(/tools/plate/leonida.otf)"),
    new FontFace(FONT.goodtime, "url(/tools/plate/goodtime.woff)"),
    new FontFace(FONT.number, "url(/tools/plate/plate-number.woff)"),
  ];
  const img = new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = "/tools/plate/orange.webp";
  });
  assets = Promise.all([...fonts.map((f) => f.load().then((ff) => document.fonts.add(ff))), img]).then(() => img);
  assets.catch(() => (assets = null));
  return assets;
}

/* ---------- Geometry shared with the 3D plate ---------- */

/** Mounting holes in plate units (0..1): two round at the top, two slots at the bottom. */
export const HOLES = {
  round: [
    { x: 0.205, y: 0.1, r: 0.028 },
    { x: 0.795, y: 0.1, r: 0.028 },
  ],
  slots: [
    { x: 0.205, y: 0.86, w: 0.075, h: 0.034 },
    { x: 0.795, y: 0.86, w: 0.075, h: 0.034 },
  ],
};
export const CORNER = 0.055; // of height

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Writes `text` with extra tracking, centred on x, fitted to a cap height (and a max width). */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  opts: { cx: number; baseline: number; cap: number; tracking: number; maxWidth: number; align?: "center" | "left" | "right"; weight?: string },
  paint: (ch: string, x: number, y: number) => void,
) {
  // Size the font so the capitals are exactly `cap` tall.
  ctx.font = `${opts.weight ?? "normal"} 100px ${family}`;
  const m = ctx.measureText("H");
  const capAt100 = m.actualBoundingBoxAscent || 72;
  const size = (opts.cap / capAt100) * 100;
  ctx.font = `${opts.weight ?? "normal"} ${size}px ${family}`;
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const track = opts.tracking * size;
  const natural = widths.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1);
  // Condense (never stretch) when it doesn't fit, like a narrower die on a real plate.
  const sx = natural > opts.maxWidth ? opts.maxWidth / natural : 1;
  const total = natural * sx;
  const align = opts.align ?? "center";
  let x = align === "center" ? opts.cx - total / 2 : align === "left" ? opts.cx : opts.cx - total;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.save();
    ctx.translate(x, opts.baseline);
    ctx.scale(sx, 1);
    paint(c, 0, 0);
    ctx.restore();
    x += (widths[i] + track) * sx;
  });
  ctx.restore();
}

/** Where the characters go: split either side of the oranges, like "VCE 🍊 CTY". */
function characterGroups(text: string) {
  const n = text.length;
  const leftN = Math.floor(n / 2);
  return { left: text.slice(0, leftN), right: text.slice(leftN) };
}

const NUMBER = { cap: 0.47, baseline: 0.735, tracking: 0.04, leftEnd: 0.418, rightStart: 0.645, leftMin: 0.055, rightMax: 0.945 };

function eachCharacter(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, paint: (ch: string, x: number, y: number) => void) {
  const { left, right } = characterGroups(text);
  const common = { cap: NUMBER.cap * H, baseline: NUMBER.baseline * H, tracking: NUMBER.tracking };
  if (left) drawTracked(ctx, left, FONT.number, { ...common, cx: NUMBER.leftEnd * W, maxWidth: (NUMBER.leftEnd - NUMBER.leftMin) * W, align: "right" }, paint);
  if (right) drawTracked(ctx, right, FONT.number, { ...common, cx: NUMBER.rightStart * W, maxWidth: (NUMBER.rightMax - NUMBER.rightStart) * W, align: "left" }, paint);
}

/* ---------- Face ---------- */

export function drawPlateFace(ctx: CanvasRenderingContext2D, text: string, style: PlateStyle, orange: HTMLImageElement, W = PLATE_W, H = PLATE_H) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  roundRect(ctx, 0, 0, W, H, CORNER * H);
  ctx.clip();

  // Reflective sheeting: soft vertical gradient, a faint sheen and fine grain.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, style.bg[0]);
  g.addColorStop(1, style.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, "rgba(255,255,255,0.18)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H);

  // The oranges sit behind the characters.
  const ow = 0.46 * W;
  const oh = (ow * orange.naturalHeight) / orange.naturalWidth;
  ctx.globalAlpha = style.orangeAlpha;
  ctx.drawImage(orange, 0.535 * W - ow / 2, 0.5 * H - oh / 2, ow, oh);
  ctx.globalAlpha = 1;

  // LEONIDA and GOODTIME STATE are screen printed (flat).
  ctx.fillStyle = style.print;
  drawTracked(ctx, "LEONIDA", FONT.leonida, { cx: W / 2, baseline: 0.225 * H, cap: 0.125 * H, tracking: 0.05, maxWidth: 0.5 * W }, (c, x, y) => ctx.fillText(c, x, y));
  drawTracked(ctx, "GOODTIME STATE", FONT.goodtime, { cx: W / 2, baseline: 0.9 * H, cap: 0.088 * H, tracking: 0.02, maxWidth: 0.47 * W }, (c, x, y) => ctx.fillText(c, x, y));

  // Stamped characters, with a whisper of shadow so they read as raised in 2D too.
  ctx.fillStyle = style.text;
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 0.008 * H;
  ctx.shadowOffsetX = 0.004 * H;
  ctx.shadowOffsetY = 0.006 * H;
  eachCharacter(ctx, W, H, text, (c, x, y) => ctx.fillText(c, x, y));
  ctx.shadowColor = "transparent";

  // Stamped rim: light catches the top edge, shade on the bottom.
  const inset = 0.03 * H;
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, CORNER * H * 0.7);
  ctx.lineWidth = 0.012 * H;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.stroke();
  roundRect(ctx, inset + 0.004 * H, inset + 0.004 * H, W - inset * 2, H - inset * 2, CORNER * H * 0.7);
  ctx.lineWidth = 0.006 * H;
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.stroke();

  ctx.restore();
}

/** Height map for 3D: black is flat sheet, white is fully raised (characters and rim). */
export function drawPlateBump(ctx: CanvasRenderingContext2D, text: string, W = PLATE_W, H = PLATE_H) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // Rounded profile: widest and darkest first, narrowest and brightest last.
  const steps = 7;
  const inset = 0.03 * H;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const v = Math.round(60 + 195 * t);
    roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, CORNER * H * 0.7);
    ctx.lineWidth = 0.022 * H * (1 - t) + 0.006 * H;
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.stroke();
  }
  ctx.lineJoin = "round";
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const v = Math.round(40 + 215 * t);
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 0.02 * H * (1 - t);
    eachCharacter(ctx, W, H, text, (c, x, y) => {
      if (ctx.lineWidth > 0.5) ctx.strokeText(c, x, y);
      if (i === steps - 1) ctx.fillText(c, x, y);
    });
  }
}

/* ---------- 2D frame (PNG export and 2D view) ---------- */

const FRAME_COLORS: Record<Exclude<FrameKind, "none">, [string, string, string]> = {
  chrome: ["#f4f6f8", "#9aa3ab", "#e3e7ea"],
  black: ["#3a3d40", "#0d0e0f", "#26282a"],
  gold: ["#f7e3a1", "#a9802f", "#e9c76b"],
};

/** A finished picture: the plate with its frame and holes, on a transparent background. */
export function drawPlatePicture(ctx: CanvasRenderingContext2D, face: HTMLCanvasElement, frame: FrameKind, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pad = frame === "none" ? 0 : 0.06 * H;
  const pw = W - pad * 2;
  const ph = (pw * PLATE_H) / PLATE_W;
  const py = (H - ph) / 2;
  if (frame !== "none") {
    const [hi, lo, mid] = FRAME_COLORS[frame];
    const g = ctx.createLinearGradient(0, py - pad, 0, py + ph + pad);
    g.addColorStop(0, hi);
    g.addColorStop(0.5, lo);
    g.addColorStop(0.75, mid);
    g.addColorStop(1, lo);
    ctx.fillStyle = g;
    roundRect(ctx, 0, py - pad, W, ph + pad * 2, CORNER * ph + pad);
    ctx.fill();
    // Studs along the frame.
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    const step = pad * 0.42;
    for (let x = pad; x < W - pad; x += step) {
      for (const y of [py - pad / 2, py + ph + pad / 2]) {
        ctx.beginPath();
        ctx.arc(x, y, pad * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let y = py; y < py + ph; y += step) {
      for (const x of [pad / 2, W - pad / 2]) {
        ctx.beginPath();
        ctx.arc(x, y, pad * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.drawImage(face, pad, py, pw, ph);
  // Holes and slots (dark, like the car behind them).
  ctx.fillStyle = "#1b1d1f";
  for (const h of HOLES.round) {
    ctx.beginPath();
    ctx.arc(pad + h.x * pw, py + h.y * ph, h.r * ph, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of HOLES.slots) {
    roundRect(ctx, pad + (s.x - s.w / 2) * pw, py + (s.y - s.h / 2) * ph, s.w * pw, s.h * ph, (s.h * ph) / 2);
    ctx.fill();
  }
}

/* Fine grain, cached once (drawing noise per edit would be slow). */
let grainCanvas: HTMLCanvasElement | null = null;
function grain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  if (!grainCanvas) {
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = 256;
    grainCanvas.height = 256;
    const g = grainCanvas.getContext("2d")!;
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 10;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.fillStyle = ctx.createPattern(grainCanvas, "repeat")!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
