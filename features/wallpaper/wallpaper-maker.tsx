"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Crosshair, Download, Layers, LoaderCircle, Monitor, RotateCcw, Search, Smartphone, Tablet, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface WallpaperArt {
  slug: string;
  title: string;
  category: string;
  width: number;
  height: number;
  thumb: string;
  /** ~1920px variant, for the live preview. */
  preview: string;
  /** Original file, for the export. */
  full: string;
  color: string | null;
}

interface Preset {
  id: string;
  label: string;
  w: number;
  h: number;
}

const PRESETS: { group: string; icon: typeof Monitor; items: Preset[] }[] = [
  {
    group: "Phone",
    icon: Smartphone,
    items: [
      { id: "iphone-18-pro-max", label: "iPhone 18 Pro Max", w: 1320, h: 2868 },
      { id: "iphone-16-17", label: "iPhone 16 / 17", w: 1206, h: 2622 },
      { id: "galaxy-s26-ultra", label: "Galaxy S26 Ultra", w: 1440, h: 3120 },
      { id: "android", label: "Android FHD+", w: 1080, h: 2400 },
    ],
  },
  { group: "Tablet", icon: Tablet, items: [{ id: "ipad", label: "iPad Pro 13″", w: 2064, h: 2752 }] },
  {
    group: "Desktop",
    icon: Monitor,
    items: [
      { id: "1080p", label: "1080p", w: 1920, h: 1080 },
      { id: "1440p", label: "1440p", w: 2560, h: 1440 },
      { id: "4k", label: "4K", w: 3840, h: 2160 },
      { id: "macbook", label: "MacBook", w: 2560, h: 1664 },
      { id: "ultrawide", label: "Ultrawide", w: 3440, h: 1440 },
      { id: "super-ultrawide", label: "Super ultrawide", w: 5120, h: 1440 },
      { id: "steam-deck", label: "Steam Deck", w: 1280, h: 800 },
    ],
  },
];
const ALL_PRESETS = PRESETS.flatMap((g) => g.items);

/** Background framing. */
interface Framing {
  zoom: number;
  /** -1…1: how far the image is shifted across its overflow. */
  panX: number;
  panY: number;
  dim: number;
  /** Inner shadow: rises from the bottom, or (border) fades in from every edge. */
  fade: Effect & { border: boolean };
}

/** A colour picked by hue, or plain white / black. */
type Tint = number | "white" | "black";
interface Effect {
  on: boolean;
  hue: Tint;
  /** 0…1 */
  strength: number;
}
const FRESH: Framing = { zoom: 1, panX: 0, panY: 0, dim: 0, fade: { on: false, hue: "black", strength: 0.5, border: false } };

/** One media layer on top. Position is its centre, as a fraction of the canvas. */
interface Overlay {
  id: number;
  slug: string;
  x: number;
  y: number;
  /** Width as a fraction of the canvas's shorter side. */
  size: number;
  opacity: number;
  glow: Effect;
}
const OVERLAY_DEFAULTS: Omit<Overlay, "id" | "slug"> = {
  x: 0.5,
  y: 0.5,
  size: 0.6,
  opacity: 1,
  glow: { on: true, hue: 325, strength: 0.45 },
};

const CATEGORY_LABEL: Record<string, string> = { artwork: "Artwork", screenshots: "Screenshots", promotional: "Promotional" };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const colorOf = (hue: Tint, alpha = 1) =>
  hue === "white" ? `rgb(255 255 255 / ${alpha})` : hue === "black" ? `rgb(0 0 0 / ${alpha})` : `hsl(${hue} 100% 55% / ${alpha})`;
const MAX_OVERLAYS = 12;

/** Where the background lands for a W×H output: cover-fit, zoomed, then shifted by the pan. */
function placement(iw: number, ih: number, W: number, H: number, f: Framing) {
  const scale = Math.max(W / iw, H / ih) * f.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  return { x: (W - dw) / 2 - (f.panX * (dw - W)) / 2, y: (H - dh) / 2 - (f.panY * (dh - H)) / 2, dw, dh, scale };
}

/** The overlay's rectangle for a W×H output. */
function overlayRect(img: { naturalWidth: number; naturalHeight: number }, W: number, H: number, o: Overlay) {
  const w = Math.min(W, H) * o.size;
  const h = (w * img.naturalHeight) / img.naturalWidth;
  return { x: o.x * W - w / 2, y: o.y * H - h / 2, w, h };
}

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/**
 * The background's inner shadow. Normally a fade rising from the bottom edge
 * (eased, so it melts into the picture). As a border, a ring drawn just
 * outside the canvas casts its blurred shadow inward from every edge.
 */
function drawFade(ctx: CanvasRenderingContext2D, W: number, H: number, fade: Framing["fade"]) {
  if (!fade.border) {
    const height = H * (0.2 + 0.6 * fade.strength);
    const g = ctx.createLinearGradient(0, H, 0, H - height);
    for (const [at, a] of [
      [0, 1],
      [0.2, 0.86],
      [0.45, 0.55],
      [0.7, 0.22],
      [0.88, 0.06],
      [1, 0],
    ])
      g.addColorStop(at, colorOf(fade.hue, a * (0.65 + 0.35 * fade.strength)));
    ctx.fillStyle = g;
    ctx.fillRect(0, H - height, W, height);
    return;
  }
  const blur = Math.min(W, H) * 0.22 * fade.strength;
  const pad = Math.ceil(blur * 3) + 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pad, -pad, W + pad * 2, H + pad * 2);
  ctx.rect(0, 0, W, H);
  ctx.fillStyle = colorOf(fade.hue);
  ctx.shadowColor = colorOf(fade.hue);
  ctx.shadowBlur = blur;
  // Stacked passes make the fade denser towards the edge.
  const passes = 1 + Math.round(fade.strength * 3);
  for (let i = 0; i < passes; i++) ctx.fill("evenodd");
  ctx.restore();
}

/** Draws the whole wallpaper at any size; the preview and the download share it. */
function drawWallpaper(ctx: CanvasRenderingContext2D, W: number, H: number, bg: HTMLImageElement, f: Framing, color: string | null, layers: { img: HTMLImageElement; o: Overlay }[]) {
  ctx.fillStyle = color ?? "#0d0a12";
  ctx.fillRect(0, 0, W, H);
  const p = placement(bg.naturalWidth, bg.naturalHeight, W, H, f);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bg, p.x, p.y, p.dw, p.dh);
  if (f.dim > 0) {
    ctx.fillStyle = `rgba(8, 4, 14, ${f.dim})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (f.fade.on && f.fade.strength > 0) drawFade(ctx, W, H, f.fade);
  for (const { img, o } of layers) {
    const r = overlayRect(img, W, H, o);
    ctx.save();
    ctx.globalAlpha = o.opacity;
    if (o.glow.on && o.glow.strength > 0) {
      // Stacked shadows make a dense, neon-like glow that hugs the overlay's shape.
      ctx.shadowColor = colorOf(o.glow.hue);
      ctx.shadowBlur = Math.min(r.w, r.h) * 0.18 * o.glow.strength;
      for (let i = 0; i < 3; i++) ctx.drawImage(img, r.x, r.y, r.w, r.h);
      ctx.shadowColor = "transparent";
    }
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    ctx.restore();
  }
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Loads several images for the preview; returns those ready so far, by src. */
function useImages(srcs: string[]) {
  const [ready, setReady] = useState<Record<string, HTMLImageElement>>({});
  const key = [...new Set(srcs)].sort().join("|");
  useEffect(() => {
    let live = true;
    for (const src of key ? key.split("|") : [])
      loadImage(src).then(
        (img) => live && setReady((r) => (r[src] ? r : { ...r, [src]: img })),
        () => {},
      );
    return () => {
      live = false;
    };
  }, [key]);
  return ready;
}

/** Loads an image for the preview and keeps it while its source is current. */
function usePreviewImage(src: string | undefined) {
  const [state, setState] = useState<{ src: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    loadImage(src).then(
      (img) => live && setState({ src, img }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [src]);
  return state && state.src === src ? state.img : null;
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[16px] font-bold">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/20 text-[13px] text-accent-text">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block py-2">
      <span className="mb-2 flex justify-between text-[14px] font-bold text-white/85">
        {label} <span className="tabular font-medium text-white/50">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="font-range h-5 w-full cursor-pointer appearance-none bg-transparent"
        style={{ "--pct": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
      />
    </label>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300", checked ? "bg-accent" : "bg-white/15")}>
      <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]", checked && "translate-x-5")} />
    </button>
  );
}

/** On/off, any hue (or white) and a strength, for one overlay effect. */
function EffectControl<T extends Effect>({ label, value, onChange, children }: { label: string; value: T; onChange: (e: T) => void; children?: ReactNode }) {
  const set = (p: Partial<Effect>) => onChange({ ...value, ...p });
  return (
    <div className="rounded-2xl bg-black/20 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[14px] font-bold text-white/85">
          <span className="size-4 rounded-full ring-2 ring-white/20" style={{ background: colorOf(value.hue), boxShadow: value.on && value.hue !== "black" ? `0 0 12px ${colorOf(value.hue)}` : undefined }} />
          {label}
        </span>
        <Switch label={label} checked={value.on} onChange={() => set({ on: !value.on })} />
      </div>
      {value.on && (
        <div className="mt-3 grid gap-1">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={typeof value.hue === "number" ? value.hue : 0}
              onChange={(e) => set({ hue: Number(e.target.value) })}
              aria-label={`${label} colour`}
              className="hue-range h-5 flex-1 cursor-pointer appearance-none bg-transparent"
              style={{ "--thumb": colorOf(typeof value.hue === "number" ? value.hue : 0) } as CSSProperties}
            />
            {(["white", "black"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set({ hue: t })}
                aria-pressed={value.hue === t}
                className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-bold capitalize transition-colors", value.hue === t ? "bg-white text-[#140c18]" : "bg-white/[0.08] text-white/70 hover:text-white")}
              >
                {t}
              </button>
            ))}
          </div>
          <Slider label="Strength" value={value.strength} min={0.05} max={1} step={0.01} display={`${Math.round(value.strength * 100)}%`} onChange={(strength) => set({ strength })} />
          {children}
        </div>
      )}
    </div>
  );
}

const chip = (active: boolean) =>
  cn("h-9 rounded-full px-3.5 text-[13.5px] font-bold whitespace-nowrap transition-colors", active ? "bg-white text-[#140c18]" : "bg-white/[0.06] text-white/70 hover:bg-white/12 hover:text-white");

const CHECKER: CSSProperties = {
  backgroundImage: "linear-gradient(45deg,#ffffff14 25%,transparent 25%),linear-gradient(-45deg,#ffffff14 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ffffff14 75%),linear-gradient(-45deg,transparent 75%,#ffffff14 75%)",
  backgroundSize: "14px 14px",
  backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
};

/** Searchable grid of media thumbnails. */
function MediaGrid({ items, selected, onPick, checker, empty }: { items: WallpaperArt[]; selected: string | undefined; onPick: (a: WallpaperArt) => void; checker?: boolean; empty: string }) {
  const [shown, setShown] = useState(48);
  return (
    <>
      {/* The scroll box wraps the grid (a grid that scrolls itself collapses its rows in iOS Safari). */}
      <div className="no-scrollbar max-h-[380px] overflow-y-auto overscroll-contain pr-1" data-lenis-prevent>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.slice(0, shown).map((a) => (
          <button
            key={a.slug}
            type="button"
            onClick={() => onPick(a)}
            title={a.title}
            aria-pressed={selected === a.slug}
            className={cn("relative block w-full overflow-hidden rounded-xl border-2 pt-[100%] transition-colors", selected === a.slug ? "border-accent" : "border-transparent hover:border-white/30")}
            style={checker ? CHECKER : { backgroundColor: a.color ?? undefined }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- archive thumbnail */}
            <img src={a.thumb} alt={a.title} loading="lazy" className={cn("absolute inset-0 size-full", checker ? "object-contain p-1.5" : "object-cover")} />
          </button>
        ))}
      </div>
      </div>
      {items.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + 48)} className="mt-3 h-10 w-full rounded-xl bg-white/[0.06] text-[13.5px] font-bold text-white/70 hover:bg-white/12 hover:text-white">
          Show more ({items.length - shown})
        </button>
      )}
      {items.length === 0 && <p className="py-6 text-center text-[14px] text-white/45">{empty}</p>}
    </>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative mb-3 block">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-2xl border border-white/10 bg-black/25 pr-4 pl-10 text-[14.5px] text-white outline-none placeholder:text-white/30 focus:border-accent"
      />
    </label>
  );
}

const matches = (a: WallpaperArt, q: string) => !q || a.title.toLowerCase().includes(q);

/* ------------------------------------------------------------------ */
/* Maker                                                               */
/* ------------------------------------------------------------------ */

export function WallpaperMaker({ art, cutouts }: { art: WallpaperArt[]; cutouts: WallpaperArt[] }) {
  const [presetId, setPresetId] = useState("iphone-18-pro-max");
  const [custom, setCustom] = useState({ w: 1920, h: 1080 });
  const preset = presetId === "custom" ? { id: "custom", label: "Custom", ...custom } : (ALL_PRESETS.find((p) => p.id === presetId) ?? ALL_PRESETS[0]);
  const W = preset.w;
  const H = preset.h;

  // Background: best-fitting art first (aspect ratio closest to the screen's).
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const target = Math.log(W / H);
    const q = query.trim().toLowerCase();
    return art
      .filter((a) => (category === "all" || a.category === category) && matches(a, q))
      .map((a) => ({ a, fit: Math.abs(Math.log(a.width / a.height) - target) }))
      .sort((x, y) => x.fit - y.fit)
      .map((x) => x.a);
  }, [art, category, query, W, H]);
  // Until the visitor picks one, show the best fit for the chosen screen.
  const [slug, setSlug] = useState("");
  const current = art.find((a) => a.slug === slug) ?? list[0] ?? art[0];
  const [framing, setFraming] = useState<Framing>(FRESH);
  const f = framing;

  // Overlays: any number of media layers on top (last one is drawn on top); cut-outs first in the picker.
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const nextId = useRef(1);
  const [overlaySource, setOverlaySource] = useState<"cutouts" | "all">("cutouts");
  const [overlayQuery, setOverlayQuery] = useState("");
  const overlayPool = overlaySource === "cutouts" ? cutouts : art;
  const overlayList = useMemo(() => overlayPool.filter((a) => matches(a, overlayQuery.trim().toLowerCase())), [overlayPool, overlayQuery]);
  const artBySlug = useMemo(() => new Map([...art, ...cutouts].map((a) => [a.slug, a])), [art, cutouts]);
  const selected = overlays.find((o) => o.id === selectedId) ?? null;
  const patchOverlay = (id: number, p: Partial<Overlay>) => setOverlays((list) => list.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const addOverlay = (a: WallpaperArt) => {
    if (overlays.length >= MAX_OVERLAYS) return;
    const id = nextId.current++;
    // New layers cascade a little so they don't hide exactly behind each other.
    const n = overlays.length;
    setOverlays((list) => [...list, { id, slug: a.slug, ...OVERLAY_DEFAULTS, x: clamp(0.5 + (n % 5) * 0.05, 0, 1), y: clamp(0.5 + (n % 5) * 0.05, 0, 1) }]);
    setSelectedId(id);
  };
  const removeOverlay = (id: number) => {
    setOverlays((list) => list.filter((o) => o.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  };
  const moveLayer = (id: number, d: -1 | 1) =>
    setOverlays((list) => {
      const i = list.findIndex((o) => o.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const bgImg = usePreviewImage(current?.preview);
  const overlayImgs = useImages(overlays.map((o) => artBySlug.get(o.slug)?.preview ?? ""));
  const layers = overlays.flatMap((o) => {
    const img = overlayImgs[artBySlug.get(o.slug)?.preview ?? ""];
    return img ? [{ img, o }] : [];
  });

  // Preview canvas: drawn at the frame's on-screen size × devicePixelRatio.
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !bgImg || !box.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(box.w * dpr);
    el.height = Math.round(box.h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    drawWallpaper(ctx, el.width, el.height, bgImg, f, current?.color ?? null, layers);
    // Outline the layer being edited (preview only).
    const sel = layers.find((l) => l.o.id === selectedId);
    if (sel) {
      const r = overlayRect(sel.img, el.width, el.height, sel.o);
      ctx.save();
      ctx.setLineDash([8 * dpr, 6 * dpr]);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }, [bgImg, layers, f, box, current, selectedId]);

  // Pointer: on a layer it selects and moves that layer; elsewhere it pans the background.
  const drag = useRef<{ x: number; y: number; target: number | "bg" } | null>(null);
  const layerAt = (clientX: number, clientY: number): number | null => {
    const el = canvas.current;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const x = clientX - b.left;
    const y = clientY - b.top;
    // Topmost first.
    for (let i = layers.length - 1; i >= 0; i--) {
      const r = overlayRect(layers[i].img, b.width, b.height, layers[i].o);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return layers[i].o.id;
    }
    return null;
  };
  const [hoverId, setHoverId] = useState<number | null>(null);
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) {
      setHoverId(layerAt(e.clientX, e.clientY));
      return;
    }
    if (!bgImg || !box.w) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { ...drag.current, x: e.clientX, y: e.clientY };
    const target = drag.current.target;
    if (target !== "bg") {
      setOverlays((list) => list.map((o) => (o.id === target ? { ...o, x: clamp(o.x + dx / box.w, 0, 1), y: clamp(o.y + dy / box.h, 0, 1) } : o)));
      return;
    }
    const p = placement(bgImg.naturalWidth, bgImg.naturalHeight, box.w, box.h, f);
    setFraming((x) => ({
      ...x,
      panX: p.dw > box.w ? clamp(x.panX - (2 * dx) / (p.dw - box.w), -1, 1) : 0,
      panY: p.dh > box.h ? clamp(x.panY - (2 * dy) / (p.dh - box.h), -1, 1) : 0,
    }));
  };
  // Wheel: resizes the layer under the cursor, otherwise zooms the background.
  const wheelTarget = useRef<() => number | null>(() => null);
  useEffect(() => {
    wheelTarget.current = () => hoverId;
  });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const k = e.deltaY < 0 ? 1.06 : 1 / 1.06;
      const id = wheelTarget.current();
      if (id !== null) setOverlays((list) => list.map((o) => (o.id === id ? { ...o, size: clamp(o.size * k, 0.05, 1.5) } : o)));
      else setFraming((x) => ({ ...x, zoom: clamp(x.zoom * k, 1, 4) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // How much the background is enlarged at full size; above ~1.3× it starts to look soft.
  const upscale = current ? Math.max(W / current.width, H / current.height) * f.zoom : 1;

  const [saving, setSaving] = useState(false);
  const download = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const [full, ...tops] = await Promise.all([loadImage(current.full), ...overlays.map((o) => loadImage(artBySlug.get(o.slug)?.full ?? "").catch(() => null))]);
      const out = makeCanvas(W, H);
      const ctx = out.getContext("2d");
      if (!ctx) return;
      drawWallpaper(ctx, W, H, full, f, current.color, overlays.flatMap((o, i) => (tops[i] ? [{ img: tops[i]!, o }] : [])));
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.93));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gta6hub-${current.slug}-${W}x${H}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setSaving(false);
    }
  };

  const portrait = H > W;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-start">
      {/* Preview */}
      <div className="grid justify-items-center gap-4 lg:sticky lg:top-28">
        <div
          className={cn("relative overflow-hidden bg-[#0d0a12] shadow-[0_40px_100px_-30px_rgb(0_0_0/0.8)]", portrait ? "rounded-[34px] ring-[6px] ring-[#1d1724]" : "rounded-[14px] ring-[5px] ring-[#1d1724]")}
          style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, calc(${portrait ? 66 : 62}vh * ${W / H}))` }}
        >
          <canvas
            ref={canvas}
            className={cn("block size-full touch-none", hoverId !== null ? "cursor-move" : "cursor-grab active:cursor-grabbing")}
            data-cursor="drag"
            data-cursor-label={hoverId !== null ? "Move" : "Drag"}
            aria-label="Wallpaper preview. Drag the picture to frame it, drag an overlay to move it, scroll to zoom or resize."
            role="img"
            onPointerDown={(e) => {
              const hit = layerAt(e.clientX, e.clientY);
              if (hit !== null) setSelectedId(hit);
              drag.current = { x: e.clientX, y: e.clientY, target: hit ?? "bg" };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onPointerLeave={() => !drag.current && setHoverId(null)}
          />
          {!bgImg && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LoaderCircle className="size-6 animate-spin text-white/50" />
            </span>
          )}
        </div>
        <p className="text-center text-[13px] text-white/45">
          {preset.label} · {W}×{H} · drag to frame{overlays.length ? ", drag an overlay to move it, scroll over it to resize" : ", scroll to zoom"}
        </p>
        <div className="flex w-full max-w-md flex-col gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!current || saving}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[image:var(--sunset)] px-7 text-[16px] font-bold text-white shadow-[0_12px_32px_-12px_rgb(255_79_163/0.9)] transition-transform duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="size-5 animate-spin" /> : <Download className="size-5" />}
            {saving ? "Making your wallpaper…" : `Download ${W}×${H}`}
          </button>
          {upscale > 1.3 && (
            <p className="text-center text-[12.5px] text-[#ffcc80]">This picture is smaller than your screen{f.zoom > 1 ? " at this zoom" : ""}, so it will look a little soft.</p>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-4">
        <Step n={1} title="Screen size">
          <div className="grid gap-3">
            {PRESETS.map(({ group, icon: Icon, items }) => (
              <div key={group}>
                <p className="mb-2 flex items-center gap-2 text-[12.5px] font-bold tracking-[0.12em] text-white/40 uppercase">
                  <Icon className="size-3.5" /> {group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((p) => (
                    <button key={p.id} type="button" onClick={() => setPresetId(p.id)} className={chip(presetId === p.id)} title={`${p.w}×${p.h}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPresetId("custom")} className={chip(presetId === "custom")}>
                Custom
              </button>
              {presetId === "custom" &&
                (["w", "h"] as const).map((k, i) => (
                  <span key={k} className="flex items-center gap-2">
                    {i === 1 && <span className="text-white/40">×</span>}
                    <input
                      type="number"
                      min={320}
                      max={7680}
                      value={custom[k]}
                      aria-label={k === "w" ? "Width" : "Height"}
                      onChange={(e) => setCustom((c) => ({ ...c, [k]: clamp(Math.round(Number(e.target.value) || 0), 320, 7680) }))}
                      className="h-9 w-24 rounded-xl border border-white/10 bg-black/25 px-3 text-[14px] text-white outline-none focus:border-accent"
                    />
                  </span>
                ))}
            </div>
          </div>
        </Step>

        <Step n={2} title="Background" aside={<span className="text-[12.5px] text-white/40">Best fit first</span>}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {["all", ...Object.keys(CATEGORY_LABEL)].map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
                {c === "all" ? "All" : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search artwork" />
          <MediaGrid
            items={list}
            selected={current?.slug}
            empty="Nothing matches that search."
            onPick={(a) => {
              setSlug(a.slug);
              setFraming((x) => ({ ...x, zoom: 1, panX: 0, panY: 0 }));
            }}
          />
          <div className="mt-3 border-t border-white/8 pt-2">
            <Slider label="Zoom" value={f.zoom} min={1} max={4} step={0.01} display={`${f.zoom.toFixed(2)}×`} onChange={(zoom) => setFraming((x) => ({ ...x, zoom }))} />
            <Slider label="Darken" value={f.dim} min={0} max={0.7} step={0.01} display={`${Math.round(f.dim * 100)}%`} onChange={(dim) => setFraming((x) => ({ ...x, dim }))} />
            <div className="mt-2">
              <EffectControl label="Inner shadow" value={f.fade} onChange={(fade) => setFraming((x) => ({ ...x, fade }))}>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span>
                    <span className="block text-[14px] font-bold text-white/85">Border</span>
                    <span className="block text-[12.5px] text-white/45">{f.fade.border ? "Fades in from every edge" : "Rises from the bottom"}</span>
                  </span>
                  <Switch label="Inner shadow border" checked={f.fade.border} onChange={() => setFraming((x) => ({ ...x, fade: { ...x.fade, border: !x.fade.border } }))} />
                </div>
              </EffectControl>
            </div>
          </div>
        </Step>

        <Step n={3} title="Overlays" aside={<span className="text-[12.5px] text-white/40">{overlays.length}/{MAX_OVERLAYS}</span>}>
          <p className="-mt-1 mb-3 text-[13.5px] text-white/50">Tap anything to add it on top: logos, character cut-outs, other screenshots. Add as many as you like.</p>

          {overlays.length > 0 && (
            <ul className="mb-4 grid gap-1.5" aria-label="Layers">
              {[...overlays].reverse().map((o, i) => {
                const a = artBySlug.get(o.slug);
                const active = o.id === selectedId;
                return (
                  <li key={o.id}>
                    <div className={cn("flex items-center gap-2 rounded-2xl border p-1.5 pr-2 transition-colors", active ? "border-accent bg-accent/10" : "border-white/10 bg-black/20")}>
                      <button type="button" onClick={() => setSelectedId(active ? null : o.id)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span className="size-10 shrink-0 overflow-hidden rounded-xl" style={CHECKER}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- layer thumbnail */}
                          {a && <img src={a.thumb} alt="" className="size-full object-contain p-0.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-bold">{a?.title ?? o.slug}</span>
                          <span className="block text-[12px] text-white/45">{i === 0 ? "Top layer" : `Layer ${overlays.length - i}`}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Bring forward"
                        title="Bring forward"
                        onClick={() => moveLayer(o.id, 1)}
                        disabled={i === 0}
                        className="flex size-8 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-25"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Send backward"
                        title="Send backward"
                        onClick={() => moveLayer(o.id, -1)}
                        disabled={i === overlays.length - 1}
                        className="flex size-8 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-25"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove layer"
                        title="Remove layer"
                        onClick={() => removeOverlay(o.id)}
                        className="flex size-8 items-center justify-center rounded-lg text-white/55 hover:bg-[#ff4d6d]/20 hover:text-[#ff8a9a]"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {active && (
                      <div className="mt-2 mb-1 grid gap-3 rounded-2xl bg-white/[0.03] p-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => patchOverlay(o.id, { x: 0.5, y: 0.5 })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-bold text-white/70 hover:bg-white/12 hover:text-white"
                          >
                            <Crosshair className="size-3.5" /> Centre
                          </button>
                        </div>
                        <Slider label="Size" value={o.size} min={0.05} max={1.5} step={0.01} display={`${Math.round(o.size * 100)}%`} onChange={(size) => patchOverlay(o.id, { size })} />
                        <Slider
                          label="Opacity"
                          value={o.opacity}
                          min={0.1}
                          max={1}
                          step={0.01}
                          display={`${Math.round(o.opacity * 100)}%`}
                          onChange={(opacity) => patchOverlay(o.id, { opacity })}
                        />
                        <EffectControl label="Glow" value={o.glow} onChange={(glow) => patchOverlay(o.id, { glow })} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setOverlaySource("cutouts")} className={chip(overlaySource === "cutouts")}>
              <Layers className="mr-1.5 inline size-3.5" />
              Cut-outs
            </button>
            <button type="button" onClick={() => setOverlaySource("all")} className={chip(overlaySource === "all")}>
              Any image
            </button>
          </div>
          <SearchBox value={overlayQuery} onChange={setOverlayQuery} placeholder="Search overlays" />
          <MediaGrid items={overlayList} selected={selected?.slug} checker={overlaySource === "cutouts"} empty="Nothing matches that search." onPick={addOverlay} />
          {overlays.length >= MAX_OVERLAYS && <p className="mt-2 text-[12.5px] text-[#ffcc80]">That’s the maximum of {MAX_OVERLAYS} layers. Remove one to add another.</p>}
        </Step>

        <button
          type="button"
          onClick={() => {
            setFraming(FRESH);
            setOverlays([]);
            setSelectedId(null);
          }}
          className="inline-flex items-center justify-center gap-2 self-start rounded-full px-3 py-2 text-[13px] font-bold text-white/45 hover:text-white"
        >
          <RotateCcw className="size-3.5" /> Start over
        </button>
      </div>
    </div>
  );
}
