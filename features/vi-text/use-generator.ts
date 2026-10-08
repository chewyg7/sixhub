"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  BACKGROUNDS,
  DEFAULTS,
  FONT_PRICEDOWN,
  FONT_PRICEDOWN_BLACK,
  FONT_PRICEDOWN_SS01,
  FONT_SCRIPT,
  FONT_SYSTEM,
  FONT_TITLE,
  LABELS,
  MEASURE_SIZE,
  OVERLAY_SIZE,
  SCRIPT_SIZE,
  STYLES,
  STYLE_CYCLE_MS,
  TEXTURE_COLOR,
  TEXTURE_MONO,
  pickInitialText,
  type BackgroundMode,
  type StyleKey,
} from "./engine/config";
import {
  layoutComposition,
  layoutLayerBlock,
  planCanvas,
  pricedownSideBearing,
  resetLayoutCaches,
  titleCapHeight,
} from "./engine/layout";
import { createTextureCache, renderComposition } from "./engine/render";
import { toRawLines, toUpperLines } from "./engine/text";
import { canvasToPng, deliverPng, exportFileName } from "./engine/export";

export interface FitBox {
  width: number;
  height: number;
}

/** Second text layer shown for the Overlay (overlay text) and 3D (script text) styles. */
export interface SecondLayer {
  kind: "overlay" | "script";
  text: string;
  setText: (v: string) => void;
  label: string;
  placeholder: string;
  uppercase: boolean;
  size: number;
  setSize: (v: number) => void;
  sizeLabel: string;
  sizeMin: number;
  sizeMax: number;
}

type Updater<T> = T | ((prev: T) => T);

export interface GeneratorController {
  text: string;
  setText: (v: string) => void;
  overlayText: string;
  setOverlayText: (v: string) => void;
  showOverlay: boolean;
  showPricedownControls: boolean;
  showLineSpacingControls: boolean;
  secondLayer: SecondLayer | null;
  hasArtwork: boolean;
  style: StyleKey;
  setStyle: (v: StyleKey) => void;
  innerOutlineWhite: boolean;
  setInnerOutlineWhite: (v: Updater<boolean>) => void;
  styleAutoCycle: boolean;
  setStyleAutoCycle: (v: boolean) => void;
  overlaySize: number;
  setOverlaySize: (v: number) => void;
  overlayLineStep: number;
  setOverlayLineStep: (v: number) => void;
  overlayInterlock: boolean;
  setOverlayInterlock: (v: Updater<boolean>) => void;
  overlayAutoStep: boolean;
  setOverlayAutoStep: (v: Updater<boolean>) => void;
  bgMode: BackgroundMode;
  bgImageKey: string;
  applyBackground: (key: string | null) => void;
  fullBackground: boolean;
  setFullBackground: (v: Updater<boolean>) => void;
  /** Selected background key, or "" when transparent. */
  selectedBackgroundKey: string;
  backgroundsExpanded: boolean;
  setBackgroundsExpanded: (v: Updater<boolean>) => void;
  asset: (path: string) => string;
  viewCanvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  bottomBarRef: RefObject<HTMLDivElement | null>;
  scheduleRedraw: () => void;
  fontReady: boolean;
  bottomPadPx: number;
  vvOffset: number;
  viewportHeight: number | null;
  exportPNG: () => Promise<void>;
  saveOverlayUrl: string | null;
  closeSaveOverlay: () => void;
}

/** Failed image loads are retried on every redraw; report each URL only once. */
const reportedMissing = new Set<string>();
function warnMissingAsset(url: string) {
  if (reportedMissing.has(url)) return;
  reportedMissing.add(url);
  console.warn(`Could not load ${url}.`);
}

export function useGenerator(fitBox: () => FitBox | null): GeneratorController {
  const fitBoxRef = useRef(fitBox);
  useLayoutEffect(() => {
    fitBoxRef.current = fitBox;
  }, [fitBox]);

  const viewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const textureCacheRef = useRef(createTextureCache());

  const asset = useCallback((path: string) => path, []);

  const [text, setText] = useState(pickInitialText);
  const [titleFontReady, setTitleFontReady] = useState(false);
  const [sharpS, setSharpS] = useState("ß");
  const [bgMode, setBgMode] = useState<BackgroundMode>(DEFAULTS.bgMode);
  const [bgImageKey, setBgImageKey] = useState(DEFAULTS.bgImageKey);
  const [fullBackground, setFullBackground] = useState(DEFAULTS.fullBackground);
  const [exportDivisor] = useState(DEFAULTS.exportDivisor);
  const [style, setStyle] = useState<StyleKey>(DEFAULTS.style);
  const [overlayText, setOverlayText] = useState(DEFAULTS.overlayText);
  const [overlaySize, setOverlaySize] = useState(DEFAULTS.overlaySize);
  const [overlayLineStep, setOverlayLineStep] = useState(DEFAULTS.overlayLineStep);
  const [overlayInterlock, setOverlayInterlock] = useState(DEFAULTS.overlayInterlock);
  const [overlayAutoStep, setOverlayAutoStep] = useState(DEFAULTS.overlayAutoStep);
  const [layerFontsReady, setLayerFontsReady] = useState(false);
  const [scriptText, setScriptText] = useState(DEFAULTS.scriptText);
  const [scriptSize, setScriptSize] = useState(DEFAULTS.scriptSize);
  const [whiteInline, setWhiteInline] = useState(DEFAULTS.whiteInline);
  const [styleAutoCycle, setStyleAutoCycle] = useState(false);

  // Optional style carousel (cycles through the four styles).
  useEffect(() => {
    if (!styleAutoCycle) return;
    const id = window.setInterval(() => {
      setStyle((cur) => {
        const i = STYLES.findIndex((s) => s.key === cur);
        return STYLES[(i + 1) % STYLES.length]?.key ?? cur;
      });
    }, STYLE_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [styleAutoCycle]);

  const measureCtx = useCallback(() => {
    if (!measureCtxRef.current) measureCtxRef.current = document.createElement("canvas").getContext("2d");
    return measureCtxRef.current;
  }, []);

  const loadImage = useCallback((url: string) => {
    const cached = imagesRef.current[url];
    if (cached) return Promise.resolve(cached);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        imagesRef.current[url] = img;
        resolve(img);
      };
      img.onerror = (err) => {
        warnMissingAsset(url);
        reject(err);
      };
      img.src = url;
    });
  }, []);

  /* ------------------------------------------------------------- fonts */
  // Effects only run in the browser, where document.fonts always exists.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      [FONT_PRICEDOWN, FONT_PRICEDOWN_SS01, FONT_PRICEDOWN_BLACK, FONT_SCRIPT].map((f) =>
        document.fonts.load(`${MEASURE_SIZE}px "${f}"`).catch(() => null),
      ),
    ).then(() => {
      if (cancelled) return;
      resetLayoutCaches();
      setLayerFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.fonts
      .load(`${MEASURE_SIZE}px "${FONT_TITLE}"`)
      .then(() => !cancelled && setTitleFontReady(true))
      .catch(() => !cancelled && setTitleFontReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Use the capital ẞ if the title font has its own glyph for it.
  useEffect(() => {
    if (!titleFontReady) return;
    const ctx = measureCtx();
    if (!ctx) return;
    ctx.font = `100px "${FONT_TITLE}", ${FONT_SYSTEM}`;
    const w = ctx.measureText("ẞ").width;
    ctx.font = `100px ${FONT_SYSTEM}`;
    setSharpS(Math.abs(w - ctx.measureText("ẞ").width) > 0.5 ? "ẞ" : "ß");
  }, [titleFontReady, measureCtx]);

  /* ------------------------------------------------------ derived lines */
  const mainLines = useMemo(() => toUpperLines(text, sharpS), [text, sharpS]);
  const isOverlay = style === "overlay";
  const overlayLines = useMemo(() => {
    if (!isOverlay) return [];
    const lines = toUpperLines(overlayText, sharpS);
    return lines.some((l) => l.trim()) ? lines : [];
  }, [overlayText, isOverlay, sharpS]);
  const isExtrude = style === "extrude";
  const extrudeLines = useMemo(() => (isExtrude && mainLines.some((l) => l.trim()) ? mainLines : []), [mainLines, isExtrude]);
  const scriptLines = useMemo(() => {
    if (extrudeLines.length === 0) return [];
    const lines = toRawLines(scriptText);
    return lines.some((l) => l.trim()) ? lines : [];
  }, [extrudeLines, scriptText]);

  const secondLayer: SecondLayer | null = isOverlay
    ? {
        kind: "overlay",
        text: overlayText,
        setText: setOverlayText,
        label: LABELS.overlayText,
        placeholder: "overlay text",
        uppercase: true,
        size: overlaySize,
        setSize: setOverlaySize,
        sizeLabel: LABELS.overlaySize,
        sizeMin: OVERLAY_SIZE.min,
        sizeMax: OVERLAY_SIZE.max,
      }
    : isExtrude
      ? {
          kind: "script",
          text: scriptText,
          setText: setScriptText,
          label: LABELS.scriptText,
          placeholder: "script text",
          uppercase: false,
          size: scriptSize,
          setSize: setScriptSize,
          sizeLabel: LABELS.scriptSize,
          sizeMin: SCRIPT_SIZE.min,
          sizeMax: SCRIPT_SIZE.max,
        }
      : null;
  const layerText = secondLayer?.text ?? "";
  const hasArtwork = useMemo(() => !!text.trim() || (isOverlay && !!overlayText.trim()), [text, isOverlay, overlayText]);

  /* ------------------------------------------------------------ layout */
  const buildPlan = useCallback(() => {
    const ctx = measureCtx();
    const overlay = layoutLayerBlock(ctx, {
      lines: overlayLines,
      sizePct: overlaySize,
      padFactor: 0.073,
      extraGap: 0,
      autoStep: overlayAutoStep,
      interlock: overlayInterlock,
      manualStep: overlayLineStep,
    });
    const extrude = layoutLayerBlock(ctx, {
      lines: extrudeLines,
      sizePct: 100,
      padFactor: 0.045,
      extraGap: 0,
      autoStep: true,
      inkGap: ctx ? pricedownSideBearing(ctx) : undefined,
      interlock: overlayInterlock,
      manualStep: overlayLineStep,
    });
    const comp = layoutComposition({ ctx, mainLines, overlay, extrude, scriptLines, scriptSize });
    const bg = bgMode === "image" ? BACKGROUNDS.find((b) => b.key === bgImageKey) : null;
    const bgImg = bg ? (imagesRef.current[asset(bg.path)] ?? null) : null;
    return planCanvas(comp, fullBackground && bgMode === "image" ? bgImg : null);
  }, [measureCtx, overlayLines, overlaySize, overlayAutoStep, overlayInterlock, overlayLineStep, extrudeLines, mainLines, scriptLines, scriptSize, bgMode, bgImageKey, fullBackground, asset]);

  const render = useCallback(
    (canvas: HTMLCanvasElement, scale: number, withBackground: boolean) => {
      const plan = buildPlan();
      const bg = BACKGROUNDS.find((b) => b.key === bgImageKey);
      return renderComposition(
        canvas,
        scale,
        {
          plan,
          style,
          whiteInline,
          overlayLines,
          extrudeLines,
          scriptLines,
          capHeight: titleCapHeight(measureCtx()),
          textureColor: imagesRef.current[asset(TEXTURE_COLOR)] ?? null,
          textureMono: imagesRef.current[asset(TEXTURE_MONO)] ?? null,
          background: withBackground
            ? { mode: bgMode, image: bgMode === "image" && bg ? (imagesRef.current[asset(bg.path)] ?? null) : null }
            : null,
        },
        textureCacheRef.current,
      );
    },
    [buildPlan, bgImageKey, style, whiteInline, overlayLines, extrudeLines, scriptLines, measureCtx, asset, bgMode],
  );

  /** Draws the preview: fit into the shell's box (never upscaled) at devicePixelRatio. */
  const drawPreview = useCallback(() => {
    const view = viewCanvasRef.current;
    if (!view) return;
    const { totalW, totalH, canvasW, canvasH } = buildPlan();
    if (!totalW || !totalH || !canvasW || !canvasH) {
      const ctx = view.getContext("2d");
      if (ctx) {
        view.width = 1;
        view.height = 1;
        ctx.clearRect(0, 0, 1, 1);
      }
      return;
    }
    const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
    const box = fitBoxRef.current() ?? null;
    const boxW = Math.max(1, box ? box.width : canvasW);
    const fit = Math.min(boxW / canvasW, Math.max(1, box ? box.height : canvasH) / canvasH);
    const scale = Math.min(1, Math.max(Math.min(1, Math.max(1 / canvasH, 1 / canvasW)), fit));
    const cssW = Math.max(1, Math.round(canvasW * scale));
    const cssH = Math.max(1, Math.round(canvasH * scale));
    if (!offscreenRef.current) offscreenRef.current = document.createElement("canvas");
    const off = offscreenRef.current;
    render(off, scale * dpr, bgMode !== "none");
    const ctx = view.getContext("2d");
    if (!ctx) return;
    view.width = Math.max(1, Math.round(cssW * dpr));
    view.height = Math.max(1, Math.round(cssH * dpr));
    view.style.width = `${cssW}px`;
    view.style.height = `${cssH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0);
  }, [bgMode, buildPlan, render]);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawPreview();
    });
  }, [drawPreview]);

  /* ------------------------------------------------------------ images */
  useEffect(() => {
    const pending: Promise<unknown>[] = [
      loadImage(asset(TEXTURE_COLOR)).catch(() => null),
      loadImage(asset(TEXTURE_MONO)).catch(() => null),
    ];
    if (bgMode === "image") {
      const bg = BACKGROUNDS.find((b) => b.key === bgImageKey);
      if (bg) pending.push(loadImage(asset(bg.path)).catch(() => null));
    }
    Promise.all(pending).then(() => scheduleRedraw());
  }, [asset, bgImageKey, bgMode, scheduleRedraw, loadImage]);

  useEffect(() => {
    if (titleFontReady) scheduleRedraw();
  }, [titleFontReady, scheduleRedraw]);
  useEffect(() => {
    if (layerFontsReady) scheduleRedraw();
  }, [layerFontsReady, scheduleRedraw]);

  /* ------------------------------------------------- desktop viewport */
  const [bottomPadPx, setBottomPadPx] = useState(80);
  useEffect(() => {
    const bar = bottomBarRef.current;
    if (!bar) return;
    const update = () => setBottomPadPx(bar.offsetHeight + 8);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const [vvOffset, setVvOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport ?? undefined;
    if (!vv) {
      const onResize = () => {
        setViewportHeight(window.innerHeight || document.documentElement?.clientHeight || null);
        setVvOffset(0);
        scheduleRedraw();
      };
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const onChange = () => {
      const keyboard = window.innerHeight - vv.height - vv.offsetTop;
      setVvOffset(keyboard > 120 ? keyboard : 0);
      setViewportHeight(vv.height);
      scheduleRedraw();
    };
    onChange();
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, [scheduleRedraw]);

  /* ------------------------------------------------------------ redraw */
  useEffect(() => {
    scheduleRedraw();
  }, [scheduleRedraw, mainLines, fullBackground, bgMode, bgImageKey, style, overlayLines, overlaySize, overlayLineStep, overlayInterlock, overlayAutoStep, whiteInline, scriptLines, scriptSize]);

  /* ------------------------------------------------------- backgrounds */
  const [backgroundsExpanded, setBackgroundsExpanded] = useState(false);
  const applyBackground = useCallback(
    (key: string | null) => {
      if (key) {
        setBgMode("image");
        setBgImageKey(key);
      } else setBgMode("none");
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  /* ------------------------------------------------------------ export */
  const [saveOverlayUrl, setSaveOverlayUrl] = useState<string | null>(null);
  const closeSaveOverlay = useCallback(() => {
    if (saveOverlayUrl) URL.revokeObjectURL(saveOverlayUrl);
    setSaveOverlayUrl(null);
  }, [saveOverlayUrl]);

  const exportPNG = useCallback(async () => {
    if (!hasArtwork) return;
    const canvas = document.createElement("canvas");
    render(canvas, 1 / Math.max(1, Number(exportDivisor) || 2), bgMode !== "none");
    const blob = await canvasToPng(canvas);
    if (!blob) return;
    const url = await deliverPng(blob, exportFileName(text, layerText));
    if (url) setSaveOverlayUrl(url);
  }, [bgMode, render, exportDivisor, hasArtwork, layerText, text]);

  return {
    text,
    setText,
    overlayText,
    setOverlayText,
    showOverlay: isOverlay,
    showPricedownControls: isOverlay || isExtrude,
    showLineSpacingControls: isOverlay,
    secondLayer,
    hasArtwork,
    style,
    setStyle,
    innerOutlineWhite: whiteInline,
    setInnerOutlineWhite: setWhiteInline,
    styleAutoCycle,
    setStyleAutoCycle,
    overlaySize,
    setOverlaySize,
    overlayLineStep,
    setOverlayLineStep,
    overlayInterlock,
    setOverlayInterlock,
    overlayAutoStep,
    setOverlayAutoStep,
    bgMode,
    bgImageKey,
    applyBackground,
    fullBackground,
    setFullBackground,
    selectedBackgroundKey: bgMode === "image" ? bgImageKey : "",
    backgroundsExpanded,
    setBackgroundsExpanded,
    asset,
    viewCanvasRef,
    containerRef,
    bottomBarRef,
    scheduleRedraw,
    fontReady: titleFontReady,
    bottomPadPx,
    vvOffset,
    viewportHeight,
    exportPNG,
    saveOverlayUrl,
    closeSaveOverlay,
  };
}
