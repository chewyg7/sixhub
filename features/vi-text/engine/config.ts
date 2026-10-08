// Generator configuration: fonts, styles, palettes, backgrounds and defaults.
import type { CSSProperties } from "react";

/* ---------------------------------------------------------------- fonts -- */

/** Main title face (GTA VI cover lettering). */
export const FONT_TITLE = "brother-1816";
/** Overlay / 3D face. */
export const FONT_PRICEDOWN = "pricedown";
/** Pricedown with the stylistic-set-01 interlocking R. */
export const FONT_PRICEDOWN_SS01 = "pricedown-ss01";
/** Heavier Pricedown, used only as a glyph fallback for the two faces above. */
export const FONT_PRICEDOWN_BLACK = "pricedown-black";
/** Script face drawn across the 3D style. */
export const FONT_SCRIPT = "damion";
export const FONT_SYSTEM = "system-ui, sans-serif";
export const FONT_PRICEDOWN_FALLBACKS = `"${FONT_PRICEDOWN_BLACK}", "${FONT_TITLE}", ${FONT_SYSTEM}`;

export type FontFamily =
  | typeof FONT_TITLE
  | typeof FONT_PRICEDOWN
  | typeof FONT_PRICEDOWN_SS01
  | typeof FONT_SCRIPT;

/** Reference size (px) all main-title metrics are measured at. */
export const MEASURE_SIZE = 500;

/* --------------------------------------------------------------- styles -- */

export type StyleKey = "colorful" | "mono-white" | "overlay" | "extrude";

export interface StyleOption {
  key: StyleKey;
  label: string;
  img: string;
  /** Alternative thumbnail shown while "Cover art style" (white inline) is on. */
  imgWhiteInline?: string;
}

export const STYLES: readonly StyleOption[] = [
  { key: "colorful", label: "Colorful", img: "/vi-text/images/style_color.png", imgWhiteInline: "/vi-text/images/style_color_white.png" },
  { key: "mono-white", label: "Mono", img: "/vi-text/images/style_mono.png" },
  { key: "overlay", label: "Overlay", img: "/vi-text/images/style_overlay.png" },
  { key: "extrude", label: "3D", img: "/vi-text/images/style_extrude.png" },
];

export function styleThumb(style: StyleOption, whiteInline: boolean): string {
  return whiteInline && style.imgWhiteInline ? style.imgWhiteInline : style.img;
}

/** Styles that draw the coloured cover-art title (and so support the white inline). */
export function isColorStyle(style: StyleKey): boolean {
  return style === "colorful" || style === "overlay";
}

/** Palm-tree band blended into the colour fill / punched out of the mono fill. */
export const TEXTURE_COLOR = "/vi-text/images/palm_tree_new.png";
export const TEXTURE_MONO = "/vi-text/images/palm_tree_new_mono.png";

/* -------------------------------------------------------------- palettes -- */

export interface ColorStop {
  stop: number;
  color: string;
}

/** Main fill, baseline (1) to cap height (0). */
export const FILL_GRADIENT: readonly ColorStop[] = [
  { stop: 1, color: "#FF964C" },
  { stop: 0.65, color: "#ff8192" },
  { stop: 0.4, color: "#f660bb" },
  { stop: 0, color: "#335fcf" },
];

/** Per-glyph sun highlight, drawn at 62° from each glyph's bottom-left. */
export const HIGHLIGHT_GRADIENT: readonly ColorStop[] = [
  { stop: 0.07, color: "rgba(255, 205, 114, 0.9)" },
  { stop: 0.15, color: "rgba(255, 172, 68, 0.9)" },
  { stop: 0.3, color: "rgba(255, 172, 68, 0.0)" },
];

/** Outer purple outline. */
export const OUTLINE_GRADIENT: readonly ColorStop[] = [
  { stop: 1, color: "#7a0078" },
  { stop: 0, color: "#3e0062" },
];

/** Darkest outline (outermost ring when the white inline is on, overlay inner stroke). */
export const DARK_OUTLINE = "#1d002e";

/** Inline gradient (cover-art style off) and overlay outer stroke. */
export const INLINE_GRADIENT: readonly ColorStop[] = [
  { stop: 1, color: "#7a0078" },
  { stop: 0.6, color: "#fd00a8" },
  { stop: 0.4, color: "#ff67d9" },
  { stop: 0, color: "#febf08" },
];

/** Extrusion / script shadow colour. */
export const EXTRUDE_COLOR = "#000000";
/** Script text outline. */
export const SCRIPT_OUTLINE = "#ff80a5";
/** Solid background colour for bgMode "color". */
export const SOLID_BACKGROUND = "#111114";

/* --------------------------------------------------------------- layout -- */

/** Padding (in 500px-measure units) around each main line. */
export const LINE_PAD = 21;
/** Margin (canvas px) around the composition when not using a full background. */
export const CANVAS_MARGIN = 80;

/** Pair kerning in 1/1000 em, applied between adjacent font runs. */
export const KERNING: Readonly<Record<string, number>> = {
  VA: -80,
  AV: -80,
  VO: -40,
  OV: -40,
  VC: -40,
  CV: -40,
  VG: -40,
  GV: -40,
  VQ: -40,
  QV: -40,
  VT: -40,
  TV: -25,
  VS: -25,
  SV: -25,
  VW: -20,
  WV: -20,
  VY: -20,
  YV: -20,
  IT: -10,
  TI: -10,
};

/** Miter limit that keeps a stroke of `width` (in 1/42 units) sharp without spiking. */
export function miterLimitFor(width: number): number {
  return width <= 0 ? 1.415 : Math.max(1.415, (84 - (LINE_PAD - width)) / width);
}

/* ---------------------------------------------------------- backgrounds -- */

export interface BackgroundOption {
  key: string;
  label: string;
  path: string;
}

export const BACKGROUNDS: readonly BackgroundOption[] = [
  { key: "cover-2", label: "Jason and Lucia Cover 2", path: "/vi-text/backgrounds/b74b36e2b61c3c2382e0a504f95e387651f406d72e68d278.webp" },
  { key: "jl-chars-bg", label: "Jason and Lucia Cover 3", path: "/vi-text/backgrounds/2026-bg.webp" },
  { key: "gta6-artwork-1-background-16-9", label: "Key Art 16:9", path: "/vi-text/backgrounds/gta6-artwork-1-background-16-9.webp" },
  { key: "gta6-artwork-1-background", label: "Key Art Portrait", path: "/vi-text/backgrounds/gta6-artwork-1-background.webp" },
  { key: "places-ambrosia-background", label: "Ambrosia", path: "/vi-text/backgrounds/places-ambrosia-background.webp" },
  { key: "places-grassrivers-background", label: "Grassrivers", path: "/vi-text/backgrounds/places-grassrivers-background.webp" },
  { key: "places-leonidakeys-background", label: "Leonida Keys", path: "/vi-text/backgrounds/places-leonidakeys-background.webp" },
  { key: "places-mountkalaga-background", label: "Mount Kalaga", path: "/vi-text/backgrounds/places-mountkalaga-background.webp" },
  { key: "places-portgellhorn-background", label: "Port Gellhorn", path: "/vi-text/backgrounds/places-portgellhorn-background.webp" },
  { key: "places-vicecity-background", label: "Vice City", path: "/vi-text/backgrounds/places-vicecity-background.webp" },
  { key: "BoobieIkeBG", label: "Boobie Ike", path: "/vi-text/backgrounds/Artwork-BoobieIkeBG-GTAVI.webp" },
  { key: "BrianHederBG", label: "Brian Heder", path: "/vi-text/backgrounds/Artwork-BrianHederBG-GTAVI.webp" },
  { key: "CalHamptonBG", label: "Cal Hampton", path: "/vi-text/backgrounds/Artwork-CalHamptonBG-GTAVI.webp" },
  { key: "DreQuanPriestBG", label: "Dre Quan Priest", path: "/vi-text/backgrounds/Artwork-DreQuanPriestBG-GTAVI.webp" },
  { key: "RaulBautistaBG", label: "Raul Bautista", path: "/vi-text/backgrounds/Artwork-RaulBautistaBG-GTAVI.webp" },
  { key: "RealDimezBG", label: "Real Dimez", path: "/vi-text/backgrounds/Artwork-RealDimezBG-GTAVI.webp" },
  { key: "ca7riel-paco-amoroso", label: "CA7RIEL & Paco Amoroso", path: "/vi-text/backgrounds/ca7riel-paco-amoroso.jpg" },
  { key: "future", label: "Future", path: "/vi-text/backgrounds/future.jpg" },
  { key: "keith-richards", label: "Keith Richards", path: "/vi-text/backgrounds/keith-richards.jpg" },
  { key: "morgan-wallen", label: "Morgan Wallen", path: "/vi-text/backgrounds/morgan-wallen.jpg" },
  { key: "raul-alejandro", label: "Raul Alejandro", path: "/vi-text/backgrounds/raul-alejandro.jpg" },
  { key: "travis-scott", label: "Travis Scott", path: "/vi-text/backgrounds/travis-scott.jpg" },
];

export const DEFAULT_BACKGROUND_KEY = BACKGROUNDS[0]?.key ?? "gta6-artwork-1-background-16-9";

export type BackgroundMode = "none" | "color" | "image";

/* ------------------------------------------------------------- defaults -- */

export const MAIN_PLACEHOLDER = "enter text here!";

/** One of these is picked at random as the initial text. */
export const INITIAL_TEXTS = [
  "JASON",
  "Port Gellhorn",
  "Lucia",
  "Leonida Keys",
  "Grassrivers",
  "LEONIDA",
  "VICE CITY",
  "BANSHEE",
  "VERCETTI",
  "ROCKSTAR",
  "INFERNUS",
  "Race n Chase",
  "19 NOVEMBER",
];
/** Until this date a "N days left" countdown is added to the random pool. */
export const COUNTDOWN_DATE = new Date(2026, 10, 18);

export function pickInitialText(now = new Date()): string {
  const pool = [...INITIAL_TEXTS];
  if (now.getTime() <= COUNTDOWN_DATE.getTime()) {
    const days = Math.ceil((COUNTDOWN_DATE.getTime() - now.getTime()) / 864e5);
    pool.push(`${days} days left`);
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? "HESOYAM";
}

export const DEFAULTS = {
  style: "colorful" as StyleKey,
  whiteInline: true,
  bgMode: "none" as BackgroundMode,
  bgImageKey: DEFAULT_BACKGROUND_KEY,
  fullBackground: false,
  overlayText: "OVERLAY",
  overlaySize: 60,
  overlayLineStep: 1.3,
  overlayInterlock: true,
  overlayAutoStep: true,
  scriptText: "Leonida",
  scriptSize: 55,
  /** Export scale divisor (1 = native composition size). */
  exportDivisor: 1,
};

export const OVERLAY_SIZE = { min: 20, max: 120 };
export const SCRIPT_SIZE = { min: 20, max: 150 };
export const LINE_STEP = { min: 0.8, max: 2.5, step: 0.05 };
/** Interval of the (currently unused by the UI) style auto-cycle. */
export const STYLE_CYCLE_MS = 1500;

/** UI labels shared by the desktop and mobile shells. */
export const LABELS = {
  coverArt: "Cover art style",
  interlock: "Interlock R",
  autoStep: "Auto line spacing",
  overlayText: "Overlay text",
  scriptText: "Script text",
  scriptSize: "Script size",
  overlaySize: "Overlay size",
  lineSpacing: "Line spacing",
  backgrounds: "Backgrounds",
  fullBackground: "Use full background",
  transparent: "Transparent",
} as const;

/** Attributes for all text-entry fields (mobile keyboards). */
export const TEXT_INPUT_PROPS = {
  inputMode: "text",
  autoCapitalize: "characters",
  autoCorrect: "off",
  spellCheck: false,
} as const;

/** Checkerboard used for the "Transparent" background tile. */
export function checkerboard(size: number): CSSProperties {
  const h = size / 2;
  return {
    backgroundImage:
      "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.15) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.15) 75%)",
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `0 0, 0 ${h}px, ${h}px -${h}px, -${h}px 0`,
  };
}
