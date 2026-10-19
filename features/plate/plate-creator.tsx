"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ChevronDown, Download, Link2, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  MAX_CHARS,
  PLATE_H,
  PLATE_W,
  DEFAULT_LAYOUT,
  STYLES,
  VARIATIONS,
  cleanPlateText,
  drawPlateBump,
  drawPlateFace,
  drawPlatePicture,
  loadPlateAssets,
  styleColors,
  type FrameKind,
  type PlateAssets,
  type PlateLayout,
  type TextColors,
  type Variation,
} from "./plate-art";
import type { PlateStudio, StudioView } from "./plate-studio";

const FRAMES: { id: FrameKind; name: string; swatch: string }[] = [
  { id: "none", name: "None", swatch: "transparent" },
  { id: "chrome", name: "Chrome", swatch: "linear-gradient(135deg,#ffffff,#8f989f 55%,#e5e9ec)" },
  { id: "black", name: "Black", swatch: "linear-gradient(135deg,#46494c,#0c0d0e)" },
  { id: "gold", name: "Gold", swatch: "linear-gradient(135deg,#fbe8a6,#a8802f 55%,#ecc96d)" },
];

const PAINTS = [
  { name: "Vice Pink", hex: "#ff4f8b" },
  { name: "Midnight", hex: "#0d0e10" },
  { name: "Gulf Teal", hex: "#1aa59e" },
  { name: "Grapefruit", hex: "#ff6a2b" },
  { name: "Glacier", hex: "#e9ecef" },
  { name: "Sunshine", hex: "#ffc53a" },
  { name: "Royal", hex: "#2546c8" },
  { name: "Gunmetal", hex: "#4a5057" },
];

type Dim = "2d" | "3d";

export interface PlateInitial {
  text?: string;
  style?: string;
  frame?: string;
  paint?: string;
  variation?: string;
  split?: string;
  rounded?: string;
  /** "rrggbb,rrggbb,rrggbb" for LEONIDA, the number and GOODTIME STATE. */
  colors?: string;
  linked?: string;
  /** Spacing: split point, gap, letter spacing, nudge. */
  at?: string;
  gap?: string;
  track?: string;
  shift?: string;
}

const LIMITS = { gap: [-0.06, 0.08], tracking: [-0.04, 0.3], shift: [-0.08, 0.08] } as const;
const clampNum = (v: string | undefined, [lo, hi]: readonly [number, number], fallback: number) => {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
function parseLayout(i: PlateInitial): PlateLayout {
  const at = Number(i.at);
  return {
    splitAt: i.at !== undefined && Number.isInteger(at) && at >= 0 && at <= MAX_CHARS ? at : null,
    gap: clampNum(i.gap, LIMITS.gap, DEFAULT_LAYOUT.gap),
    tracking: clampNum(i.track, LIMITS.tracking, DEFAULT_LAYOUT.tracking),
    shift: clampNum(i.shift, LIMITS.shift, DEFAULT_LAYOUT.shift),
  };
}

const HEX = /^[0-9a-f]{6}$/i;
function parseColors(v?: string): TextColors | null {
  const parts = v?.split(",") ?? [];
  if (parts.length !== 3 || !parts.every((x) => HEX.test(x))) return null;
  return { header: `#${parts[0]}`, number: `#${parts[1]}`, footer: `#${parts[2]}` };
}

/** Frosted glass panels, matching the rest of the site. */
const GLASS = "rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_30px_60px_-30px_rgb(0_0_0/0.8)] backdrop-blur-2xl";

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn(GLASS, "p-4 sm:p-5", className)}>{children}</section>;
}

/** A panel that folds away, like the VI Text Generator's Backgrounds. */
function Collapsible({ title, summary, children }: { title: string; summary?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={cn(GLASS, "px-4 sm:px-5")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-5 text-[13px] font-bold tracking-[0.18em] text-white/50 uppercase transition-colors hover:text-white/80"
      >
        {title}
        <span className="flex items-center gap-2 tracking-normal normal-case">
          {summary && <span className="text-[13px] font-medium text-white/55">{summary}</span>}
          <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
        </span>
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** An on/off row. */
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-[13px] font-bold tracking-[0.14em] text-white/70 uppercase">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-white/40">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300", checked ? "bg-accent" : "bg-white/15")}
      >
        <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

/** A colour swatch that opens the system colour picker. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 transition-colors hover:border-white/25">
      <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-white/25 shadow-[inset_0_1px_2px_rgb(255_255_255/0.3)]" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour`} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] font-bold text-white/85">{label}</span>
      <span className="tabular font-mono text-[12px] text-white/45 uppercase">{value}</span>
    </label>
  );
}

/** A labelled slider, styled like the rest of the site's tools. */
function Slider({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block py-2.5">
      <span className="mb-2 flex justify-between text-[13px] font-bold tracking-[0.14em] text-white/70 uppercase">
        {label} <span className="tabular font-medium tracking-normal text-white/50 normal-case">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="font-range h-5 w-full cursor-pointer appearance-none bg-transparent"
        style={{ "--pct": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </label>
  );
}

/** Segmented glass control (2D/3D, Plate/Car, Real/Game). */
function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  const i = options.findIndex((o) => o.id === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("relative grid rounded-full border border-white/12 bg-black/40 p-1 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-[image:var(--sunset)] shadow-[0_8px_24px_-8px_rgb(255_79_163/0.9)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn("relative z-10 h-9 rounded-full px-4 text-[12.5px] font-bold tracking-wide whitespace-nowrap uppercase transition-colors duration-300 sm:px-5", o.id === value ? "text-white" : "text-white/55 hover:text-white")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PlateCreator({ initial }: { initial: PlateInitial }) {
  const [text, setText] = useState(() => cleanPlateText(initial.text ?? "VCECTY") || "VCECTY");
  const [styleId, setStyleId] = useState(() => (STYLES.some((s) => s.id === initial.style) ? initial.style! : STYLES[0].id));
  const [frame, setFrame] = useState<FrameKind>(() => (FRAMES.some((f) => f.id === initial.frame) ? (initial.frame as FrameKind) : "none"));
  const [variation, setVariation] = useState<Variation>(() => (initial.variation === "game" ? "game" : "real"));
  const [split, setSplit] = useState(initial.split !== "0");
  const [rounded, setRounded] = useState(initial.rounded === "1");
  const [linked, setLinked] = useState(initial.linked !== "0");
  /** Custom text colours; null means the style's own. */
  const [custom, setCustom] = useState<TextColors | null>(() => parseColors(initial.colors));
  const [layout, setLayout] = useState<PlateLayout>(() => parseLayout(initial));
  const patchLayout = (p: Partial<PlateLayout>) => setLayout((l) => ({ ...l, ...p }));
  const customLayout = JSON.stringify(layout) !== JSON.stringify(DEFAULT_LAYOUT);
  const [paint, setPaint] = useState(() => (PAINTS.some((p) => p.hex === initial.paint) ? initial.paint! : PAINTS[0].hex));
  const [dim, setDim] = useState<Dim>("2d");
  const [view, setView] = useState<StudioView>("plate");
  const [ready, setReady] = useState(false);
  const [studioState, setStudioState] = useState<"off" | "loading" | "ready" | "error">("off");
  const [carLoading, setCarLoading] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
  const defaults = useMemo(() => styleColors(style, variation), [style, variation]);
  const colors = custom ?? defaults;
  const setColor = (key: keyof TextColors, value: string) => setCustom(linked ? { header: value, number: value, footer: value } : { ...colors, [key]: value });
  const face = useRef<HTMLCanvasElement | null>(null);
  const bump = useRef<HTMLCanvasElement | null>(null);
  const picture = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const studio = useRef<PlateStudio | null>(null);
  const art = useRef<PlateAssets | null>(null);

  // Fonts and artwork, then the style thumbnails.
  useEffect(() => {
    let live = true;
    loadPlateAssets().then((loaded) => {
      if (!live) return;
      art.current = loaded;
      face.current = Object.assign(document.createElement("canvas"), { width: PLATE_W, height: PLATE_H });
      bump.current = Object.assign(document.createElement("canvas"), { width: PLATE_W, height: PLATE_H });
      const t: Record<string, string> = {};
      const c = Object.assign(document.createElement("canvas"), { width: 512, height: 256 });
      for (const v of VARIATIONS)
        for (const s of STYLES) {
          drawPlateFace(c.getContext("2d")!, { text: "ABC1234", style: s, colors: styleColors(s, v.id), variation: v.id, split: true, rounded: false, layout: DEFAULT_LAYOUT }, loaded, 512, 256);
          t[`${v.id}:${s.id}`] = c.toDataURL("image/webp", 0.9);
        }
      setThumbs(t);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // Redraw on every change: face + height map (3D) + the framed picture (2D).
  const shown = text || " ";
  useEffect(() => {
    if (!ready || !face.current || !bump.current || !art.current) return;
    const design = { text: shown, style, colors, variation, split, rounded, layout };
    drawPlateFace(face.current.getContext("2d")!, design, art.current);
    drawPlateBump(bump.current.getContext("2d")!, design);
    const pic = picture.current;
    if (pic) drawPlatePicture(pic.getContext("2d")!, face.current, frame, pic.width, pic.height);
    studio.current?.updatePlate();
  }, [ready, shown, style, colors, variation, split, rounded, layout, frame]);

  // The 3D studio is only built the first time 3D is opened.
  const openStudio = useCallback(async () => {
    if (studio.current || !stage.current || !face.current || !bump.current) return;
    setStudioState("loading");
    try {
      const { PlateStudio } = await import("./plate-studio");
      if (!stage.current) return;
      studio.current = new PlateStudio(stage.current, face.current, bump.current, { paint });
      studio.current.setFrame(frame);
      studio.current.onCarLoading = setCarLoading;
      setStudioState("ready");
    } catch {
      setStudioState("error");
    }
    // Only the first open matters; later changes are pushed by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => studio.current?.dispose(), []);
  useEffect(() => studio.current?.setFrame(frame), [frame]);
  useEffect(() => studio.current?.setPaint(paint), [paint]);
  useEffect(() => {
    studio.current?.setActive(dim === "3d");
  }, [dim]);

  const go3d = async () => {
    setDim("3d");
    if (!studio.current) await openStudio();
    else studio.current.setActive(true);
    if (view === "plate") studio.current?.intro();
  };
  const changeDim = (d: Dim) => {
    if (d === "3d") void go3d();
    else setDim("2d");
  };
  const changeView = async (v: StudioView) => {
    setView(v);
    if (dim !== "3d") await go3d();
    studio.current?.setView(v);
  };

  // Keep the link shareable.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const p = new URLSearchParams({ text, style: styleId, variation, frame, paint, split: split ? "1" : "0", rounded: rounded ? "1" : "0", linked: linked ? "1" : "0" });
      if (custom) p.set("colors", [custom.header, custom.number, custom.footer].map((c) => c.slice(1)).join(","));
      if (layout.splitAt !== null) p.set("at", String(layout.splitAt));
      if (layout.gap !== DEFAULT_LAYOUT.gap) p.set("gap", layout.gap.toFixed(3));
      if (layout.tracking !== DEFAULT_LAYOUT.tracking) p.set("track", layout.tracking.toFixed(3));
      if (layout.shift !== DEFAULT_LAYOUT.shift) p.set("shift", layout.shift.toFixed(3));
      history.replaceState(history.state, "", `${location.pathname}?${p}`);
    }, 400);
    return () => window.clearTimeout(t);
  }, [text, styleId, variation, frame, paint, split, rounded, linked, custom, layout]);

  const download = (blob: Blob | null, name: string) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const fileBase = `leonida-plate-${(text || "blank").toLowerCase()}`;
  const savePng = () => {
    if (!face.current) return;
    const c = Object.assign(document.createElement("canvas"), { width: 2400, height: frame === "none" ? 1200 : 1380 });
    drawPlatePicture(c.getContext("2d")!, face.current, frame, c.width, c.height);
    c.toBlob((b) => download(b, `${fileBase}.png`), "image/png");
  };
  const saveShot = async () => download((await studio.current?.snapshot()) ?? null, `${fileBase}-${view}.png`);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start xl:grid-cols-[minmax(0,1fr)_460px]">
      {/* Stage and text bar */}
      <div className="grid gap-4 lg:sticky lg:top-28">
        <div
          className={cn(GLASS, "relative h-[52svh] min-h-[300px] overflow-hidden overscroll-contain bg-[radial-gradient(120%_90%_at_50%_0%,rgb(255_79_163/0.10),transparent_55%),radial-gradient(90%_70%_at_50%_100%,rgb(110_60_160/0.12),transparent_60%)] lg:h-[min(74vh,760px)]")}
          // In 3D the wheel zooms the scene instead of scrolling the page.
          data-lenis-prevent={dim === "3d" ? "" : undefined}
        >
          {/* 2D */}
          <div className={cn("absolute inset-0 flex items-center justify-center p-[7%] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]", dim === "2d" ? "opacity-100" : "pointer-events-none scale-95 opacity-0")}>
            <canvas ref={picture} width={1600} height={920} aria-label={`Leonida plate reading ${text || "nothing yet"}`} role="img" className="h-auto max-h-full w-full max-w-[920px] drop-shadow-[0_40px_60px_rgb(0_0_0/0.65)]" />
            {!ready && (
              <span className="absolute inset-0 flex items-center justify-center text-white/50">
                <Loader2 className="size-6 animate-spin" />
              </span>
            )}
          </div>
          {/* 3D */}
          <div ref={stage} className={cn("absolute inset-0 bg-black transition-opacity duration-700", dim === "3d" ? "opacity-100" : "pointer-events-none opacity-0")} />
          {/* A soft vignette over the 3D scene, like a lens. */}
          <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_55%,rgb(0_0_0/0.55))] transition-opacity duration-700", dim === "3d" ? "opacity-100" : "opacity-0")} />
          {dim === "3d" && (studioState === "loading" || carLoading) && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[13.5px] text-white/70">
              <Loader2 className="size-5 animate-spin" /> {carLoading ? "Opening 6 Hub Customs…" : "Building the garage…"}
            </span>
          )}
          {studioState === "error" && dim === "3d" && <p className="absolute inset-x-6 top-1/2 text-center text-[14px] text-white/70">3D needs WebGL, which this browser has turned off. The 2D plate still works.</p>}

          {dim === "3d" && studioState === "ready" && (
            <button
              type="button"
              onClick={() => studio.current?.resetView()}
              aria-label="Reset view"
              title="Reset view"
              className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full border border-white/12 bg-black/40 text-white/80 backdrop-blur-xl transition-colors hover:text-white"
            >
              <RotateCcw className="size-[18px]" />
            </button>
          )}

          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 sm:inset-x-5 sm:bottom-5">
            <Segmented<Dim> label="Dimension" value={dim} onChange={changeDim} options={[{ id: "2d", label: "2D" }, { id: "3d", label: "3D" }]} />
            <Segmented<StudioView> label="View" value={view} onChange={(v) => void changeView(v)} options={[{ id: "plate", label: "Plate view" }, { id: "car", label: "Car view" }]} />
          </div>
        </div>

        {/* Text, download and share */}
        <div className={cn(GLASS, "flex flex-col gap-3 p-3 sm:flex-row sm:items-center")}>
          <div className="relative flex-1">
            <input
              value={text}
              onChange={(e) => setText(cleanPlateText(e.target.value))}
              maxLength={MAX_CHARS}
              spellCheck={false}
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="Plate text"
              placeholder="VCECTY"
              className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pr-14 pl-5 font-[PlateNumber,var(--font-deco-condensed)] text-[30px] tracking-[0.14em] text-white uppercase outline-none placeholder:text-white/25 focus:border-accent"
            />
            <span className="tabular pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-mono text-[12px] text-white/40">
              {text.length}/{MAX_CHARS}
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy link to this plate"
              title={copied ? "Link copied" : "Copy link"}
              className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.07] text-white/75 transition-colors hover:bg-white/12 hover:text-white"
            >
              {copied ? <Check className="size-5 text-[#7ee8ae]" /> : <Link2 className="size-5" />}
            </button>
            <button
              type="button"
              onClick={saveShot}
              disabled={studioState !== "ready" || dim !== "3d"}
              aria-label="Save a 3D shot"
              title={dim !== "3d" ? "Switch to 3D to save a shot" : "Save a 3D shot"}
              className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.07] text-white/75 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-35"
            >
              <Camera className="size-5" />
            </button>
            <button
              type="button"
              onClick={savePng}
              disabled={!ready}
              className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[image:var(--sunset)] px-6 text-[15.5px] font-bold text-white shadow-[0_12px_32px_-12px_rgb(255_79_163/0.9)] transition-transform duration-300 hover:scale-[1.03] active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:flex-none"
            >
              <Download className="size-5" /> Download PNG
            </button>
          </div>
        </div>
        <p className="px-2 text-[12.5px] text-white/40">Up to {MAX_CHARS} characters, A–Z and 0–9. Keep it friendly. A fan-made tool, not affiliated with Rockstar Games.</p>
      </div>

      {/* Controls */}
      <div className="grid gap-4">
        <Panel>
          <div role="radiogroup" aria-label="Plate style" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {STYLES.map((s) => {
              const active = s.id === styleId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStyleId(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-2 pb-2.5 transition-[border-color,background-color,opacity]",
                    active ? "border-accent bg-accent/10" : "border-white/10 opacity-60 hover:border-white/25 hover:opacity-100",
                  )}
                >
                  <span className="block w-full overflow-hidden rounded-[7px] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.8)]" style={{ aspectRatio: "2 / 1", background: s.swatch[0] }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated preview */}
                    {thumbs[`${variation}:${s.id}`] && <img src={thumbs[`${variation}:${s.id}`]} alt="" className="block size-full" />}
                  </span>
                  <span className="text-[12px] font-bold">{s.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 divide-y divide-white/8 border-t border-white/8">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-[13px] font-bold tracking-[0.14em] text-white/70 uppercase">Variation</span>
              <Segmented<Variation> label="Variation" value={variation} onChange={setVariation} options={VARIATIONS.map((v) => ({ id: v.id, label: v.name }))} className="w-[180px]" />
            </div>
            <Toggle label="Rounded characters" checked={rounded} onChange={setRounded} />
            <Toggle label="Split around the oranges" checked={split} onChange={setSplit} />
          </div>
        </Panel>

        <Collapsible title="Spacing" summary={customLayout ? "Custom" : "Auto"}>
          {split && (
            <>
              <Slider
                label="Split after"
                value={layout.splitAt ?? -1}
                display={layout.splitAt === null ? `Auto (${Math.floor(text.length / 2)} | ${text.length - Math.floor(text.length / 2)})` : `${layout.splitAt} | ${Math.max(0, text.length - layout.splitAt)}`}
                min={-1}
                max={Math.max(1, text.length)}
                step={1}
                onChange={(v) => patchLayout({ splitAt: v < 0 ? null : v })}
              />
              <Slider
                label="Gap around the oranges"
                value={layout.gap}
                display={`${layout.gap > 0 ? "+" : ""}${Math.round(layout.gap * 1000) / 10}%`}
                min={LIMITS.gap[0]}
                max={LIMITS.gap[1]}
                step={0.002}
                onChange={(v) => patchLayout({ gap: v })}
              />
            </>
          )}
          <Slider
            label="Letter spacing"
            value={layout.tracking}
            display={`${Math.round(layout.tracking * 100)}`}
            min={LIMITS.tracking[0]}
            max={LIMITS.tracking[1]}
            step={0.01}
            onChange={(v) => patchLayout({ tracking: v })}
          />
          <Slider
            label="Nudge"
            value={layout.shift}
            display={layout.shift === 0 ? "Centred" : `${layout.shift < 0 ? "←" : "→"} ${Math.abs(Math.round(layout.shift * 1000) / 10)}%`}
            min={LIMITS.shift[0]}
            max={LIMITS.shift[1]}
            step={0.002}
            onChange={(v) => patchLayout({ shift: v })}
          />
          <button
            type="button"
            onClick={() => setLayout(DEFAULT_LAYOUT)}
            disabled={!customLayout}
            className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-bold text-white/75 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-35"
          >
            <Undo2 className="size-4" /> Reset spacing
          </button>
        </Collapsible>

        <Collapsible title="Text colours" summary={custom ? (linked ? "Custom" : "Custom, per line") : "Style colours"}>
          <Toggle
            label="Linked"
            hint={linked ? "One colour for all the text" : "Each line has its own colour"}
            checked={linked}
            onChange={(on) => {
              setLinked(on);
              // Linking makes everything match the plate number.
              if (on && custom) setCustom({ header: custom.number, number: custom.number, footer: custom.number });
            }}
          />
          <div className="mt-1 grid gap-2">
            {linked ? (
              <ColorField label="All text" value={colors.number} onChange={(v) => setColor("number", v)} />
            ) : (
              <>
                <ColorField label="LEONIDA" value={colors.header} onChange={(v) => setColor("header", v)} />
                <ColorField label="Plate number" value={colors.number} onChange={(v) => setColor("number", v)} />
                <ColorField label="GOODTIME STATE" value={colors.footer} onChange={(v) => setColor("footer", v)} />
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCustom(null)}
            disabled={!custom}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-bold text-white/75 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-35"
          >
            <Undo2 className="size-4" /> Reset to style colours
          </button>
        </Collapsible>

        <Collapsible title="Frame" summary={FRAMES.find((f) => f.id === frame)?.name}>
          <div className="grid grid-cols-4 gap-2">
            {FRAMES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrame(f.id)}
                aria-pressed={f.id === frame}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[12px] font-bold transition-colors",
                  f.id === frame ? "border-accent bg-accent/10 text-white" : "border-white/10 text-white/60 hover:border-white/25",
                )}
              >
                <span className="size-8 rounded-full border border-white/20" style={{ background: f.swatch === "transparent" ? "repeating-linear-gradient(45deg,#2a2a2e 0 4px,#16161a 4px 8px)" : f.swatch }} />
                {f.name}
              </button>
            ))}
          </div>
        </Collapsible>

        <Collapsible title="Car paint" summary={PAINTS.find((p) => p.hex === paint)?.name}>
          <div className="flex flex-wrap gap-2.5">
            {PAINTS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => {
                  setPaint(p.hex);
                  if (view !== "car") void changeView("car");
                }}
                aria-label={p.name}
                aria-pressed={p.hex === paint}
                title={p.name}
                className={cn("size-10 rounded-full border-2 transition-transform duration-300 hover:scale-110", p.hex === paint ? "scale-110 border-white" : "border-transparent")}
                style={{ background: `radial-gradient(circle at 35% 30%, rgb(255 255 255/0.45), transparent 45%), ${p.hex}` }}
              />
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-white/40">Picking a colour takes you to Car view.</p>
        </Collapsible>
      </div>
    </div>
  );
}
