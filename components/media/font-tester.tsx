"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Download, LoaderCircle, RotateCcw } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { styleWeight } from "@/lib/media/font-family";

/* ------------------------------------------------------------------ */
/* Loading fonts                                                       */
/* ------------------------------------------------------------------ */

const loaded = new Map<string, Promise<void>>();

/** CSS family name an item's font file is registered under. */
export const fontFamilyName = (item: Pick<MediaItem, "slug">) => `ghf-${item.slug}`;

/** Loads an item's font file once per page; resolves when it can render. */
export function loadFont(item: MediaItem): Promise<void> {
  const key = fontFamilyName(item);
  let p = loaded.get(key);
  if (!p) {
    const face = new FontFace(key, `url("${encodeURI(item.original.url)}")`, { display: "swap" });
    p = face.load().then((f) => void document.fonts.add(f));
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return p;
}

export function useFontReady(item: MediaItem): "loading" | "ready" | "error" {
  const [state, setState] = useState<{ slug: string; s: "loading" | "ready" | "error" }>({ slug: item.slug, s: "loading" });
  useEffect(() => {
    let live = true;
    loadFont(item).then(
      () => live && setState({ slug: item.slug, s: "ready" }),
      () => live && setState({ slug: item.slug, s: "error" }),
    );
    return () => {
      live = false;
    };
  }, [item]);
  return state.slug === item.slug ? state.s : "loading";
}

/** Styles of the same family, lightest/upright first. */
export function familyStyles(item: MediaItem, pool: MediaItem[]): MediaItem[] {
  if (item.kind !== "font" || !item.font) return [item];
  const same = pool.filter((m) => m.kind === "font" && m.font?.family === item.font!.family);
  return (same.length ? same : [item]).sort((a, b) => styleWeight(a.font?.style ?? "") - styleWeight(b.font?.style ?? ""));
}

/* ------------------------------------------------------------------ */
/* Shared tester settings (kept while switching styles)                */
/* ------------------------------------------------------------------ */

export const SAMPLE = "Welcome to Leonida";
type Case = "as-typed" | "upper" | "lower";
type Align = "left" | "center" | "right";
type Ink = "light" | "dark" | "sunset";
interface TesterState {
  text: string;
  size: number;
  tracking: number;
  leading: number;
  textCase: Case;
  align: Align;
  ink: Ink;
}
const INITIAL: TesterState = { text: SAMPLE, size: 96, tracking: 0, leading: 1.1, textCase: "as-typed", align: "left", ink: "light" };
let tester: TesterState = INITIAL;
const subs = new Set<() => void>();
export function setTester(patch: Partial<TesterState>) {
  tester = { ...tester, ...patch };
  subs.forEach((s) => s());
}
export function useTester(): TesterState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    () => tester,
    () => INITIAL,
  );
}

const INK: Record<Ink, { label: string; stage: string; text: string; swatch: string }> = {
  light: { label: "Light on dark", stage: "bg-[#0d0a12]", text: "text-white", swatch: "bg-[#0d0a12] ring-white/40" },
  dark: { label: "Dark on light", stage: "bg-[#f4efe9]", text: "text-[#140c18]", swatch: "bg-[#f4efe9] ring-black/20" },
  sunset: { label: "Sunset", stage: "bg-[linear-gradient(160deg,#2b1640,#130b1c)]", text: "sunset-text", swatch: "bg-[image:var(--sunset)] ring-white/30" },
};

const GLYPHS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
  ..."!?&@#$%*()[]{}.,:;'\"-–—/+=<>€£¥",
];
const WATERFALL = [120, 88, 64, 48, 36, 28, 20, 16, 13];

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex min-w-[150px] flex-1 flex-col gap-1.5">
      <span className="flex justify-between text-[12px] font-bold text-white/55">
        {label} <span className="tabular text-white/85">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="font-range h-5 w-full cursor-pointer appearance-none bg-transparent"
        style={{ "--pct": `${pct}%` } as CSSProperties}
      />
    </label>
  );
}

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn("flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-[13px] font-bold transition-colors", active ? "bg-white text-[#140c18]" : "text-white/65 hover:bg-white/10 hover:text-white")}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tester                                                              */
/* ------------------------------------------------------------------ */

/**
 * Try a font with your own text: type straight into the specimen, change
 * size, spacing, case, alignment and colours, see it as a waterfall, or
 * browse its glyphs. Styles of the same family switch in place.
 */
export function FontTester({ item, styles = [item], onPickStyle, className, fill }: { item: MediaItem; styles?: MediaItem[]; onPickStyle?: (m: MediaItem) => void; className?: string; fill?: boolean }) {
  const t = useTester();
  const status = useFontReady(item);
  const [view, setView] = useState<"type" | "waterfall" | "glyphs">("type");
  const [glyph, setGlyph] = useState("A");
  const area = useRef<HTMLTextAreaElement>(null);
  const family = `"${fontFamilyName(item)}", system-ui, sans-serif`;
  const ink = INK[t.ink];
  const transform = t.textCase === "upper" ? "uppercase" : t.textCase === "lower" ? "lowercase" : "none";
  const text = t.text || SAMPLE;

  // Grow the textarea with its content so the specimen never scrolls inside itself.
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${a.scrollHeight}px`;
  }, [t.text, t.size, t.leading, t.tracking, status, view, item.slug]);

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#120e17] text-white", fill && "h-full", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/8 px-4 py-3 sm:px-5">
        <div role="tablist" aria-label="View" className="flex rounded-2xl bg-white/[0.06] p-1">
          {(["type", "waterfall", "glyphs"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("h-9 rounded-xl px-3.5 text-[13px] font-bold capitalize transition-colors", view === v ? "bg-white text-[#140c18]" : "text-white/60 hover:text-white")}
            >
              {v === "type" ? "Type" : v}
            </button>
          ))}
        </div>
        {view !== "glyphs" && (
          <>
            <Slider label="Size" value={t.size} min={12} max={240} step={1} onChange={(size) => setTester({ size })} format={(v) => `${v}px`} />
            <Slider label="Spacing" value={t.tracking} min={-0.1} max={0.4} step={0.005} onChange={(tracking) => setTester({ tracking })} format={(v) => `${Math.round(v * 1000)}`} />
            {view === "type" && <Slider label="Line height" value={t.leading} min={0.7} max={2} step={0.05} onChange={(leading) => setTester({ leading })} format={(v) => v.toFixed(2)} />}
          </>
        )}
        <div className="flex items-center gap-1 rounded-2xl bg-white/[0.06] p-1">
          <Chip active={t.textCase === "as-typed"} onClick={() => setTester({ textCase: "as-typed" })} label="As typed">
            Aa
          </Chip>
          <Chip active={t.textCase === "upper"} onClick={() => setTester({ textCase: "upper" })} label="Uppercase">
            AA
          </Chip>
          <Chip active={t.textCase === "lower"} onClick={() => setTester({ textCase: "lower" })} label="Lowercase">
            aa
          </Chip>
        </div>
        {view === "type" && (
          <div className="flex items-center gap-1 rounded-2xl bg-white/[0.06] p-1">
            <Chip active={t.align === "left"} onClick={() => setTester({ align: "left" })} label="Align left">
              <AlignLeft className="size-4" />
            </Chip>
            <Chip active={t.align === "center"} onClick={() => setTester({ align: "center" })} label="Align centre">
              <AlignCenter className="size-4" />
            </Chip>
            <Chip active={t.align === "right"} onClick={() => setTester({ align: "right" })} label="Align right">
              <AlignRight className="size-4" />
            </Chip>
          </div>
        )}
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Colours">
          {(Object.keys(INK) as Ink[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={t.ink === k}
              aria-label={INK[k].label}
              title={INK[k].label}
              onClick={() => setTester({ ink: k })}
              className={cn("size-7 rounded-full ring-1 transition-transform", INK[k].swatch, t.ink === k ? "scale-110 outline-2 outline-offset-2 outline-white" : "hover:scale-110")}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTester(INITIAL)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <RotateCcw className="size-3.5" /> Reset
        </button>
      </div>

      {/* Styles in this family */}
      {styles.length > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/8 px-4 py-2.5 sm:px-5" role="radiogroup" aria-label="Style">
          {styles.map((s) => (
            <button
              key={s.slug}
              type="button"
              role="radio"
              aria-checked={s.slug === item.slug}
              onClick={() => onPickStyle?.(s)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-[13.5px] font-bold transition-colors",
                s.slug === item.slug ? "bg-accent text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/12 hover:text-white",
              )}
            >
              {s.font?.style ?? s.title}
            </button>
          ))}
        </div>
      )}

      {/* Stage */}
      <div className={cn("relative min-h-[260px] flex-1 overflow-auto transition-colors duration-500", ink.stage)} data-lenis-prevent>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-[14px] text-white/50">
            <LoaderCircle className="size-5 animate-spin" /> Loading font…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[14px] text-white/60">
            This font couldn’t be loaded for a preview.
            <a href={item.original.url} download={item.original.filename} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 font-bold text-white hover:bg-white/15">
              <Download className="size-4" /> Download it instead
            </a>
          </div>
        )}
        <div className={cn("p-5 transition-opacity duration-300 sm:p-8", status === "ready" ? "opacity-100" : "opacity-0")}>
          {view === "type" && (
            <textarea
              ref={area}
              value={t.text}
              onChange={(e) => setTester({ text: e.target.value })}
              placeholder={SAMPLE}
              spellCheck={false}
              aria-label={`Type to preview ${item.title}`}
              rows={1}
              className={cn("block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:opacity-40", ink.text)}
              style={{ fontFamily: family, fontSize: t.size, letterSpacing: `${t.tracking}em`, lineHeight: t.leading, textAlign: t.align, textTransform: transform }}
            />
          )}
          {view === "waterfall" && (
            <div className="grid gap-5">
              {WATERFALL.map((s) => (
                <div key={s} className="flex items-baseline gap-4">
                  <span className={cn("tabular w-10 shrink-0 text-[11px] font-bold opacity-50", ink.text)}>{s}</span>
                  <p className={cn("min-w-0 truncate", ink.text)} style={{ fontFamily: family, fontSize: s, letterSpacing: `${t.tracking}em`, lineHeight: 1.15, textTransform: transform }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          )}
          {view === "glyphs" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className={cn("flex aspect-square items-center justify-center rounded-2xl border border-current/10 lg:sticky lg:top-0", ink.text)}>
                <span style={{ fontFamily: family, fontSize: 200, lineHeight: 1 }}>{glyph}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
                {GLYPHS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onPointerEnter={() => setGlyph(g)}
                    onFocus={() => setGlyph(g)}
                    onClick={() => setGlyph(g)}
                    aria-label={`Glyph ${g}`}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-xl text-[26px] transition-colors",
                      ink.text,
                      glyph === g ? "bg-accent/30" : "hover:bg-current/10",
                    )}
                    style={{ fontFamily: family }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 px-4 py-3 text-[13px] text-white/55 sm:px-5">
        <span className="font-bold text-white">{item.font?.family ?? item.title}</span>
        <span>{item.font?.style}</span>
        {item.font?.glyphs ? <span>{item.font.glyphs} glyphs</span> : null}
        {item.font?.format && <span>{item.font.format}</span>}
        {item.downloadable && (
          <a
            href={item.original.url}
            download={item.original.filename}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-[image:var(--sunset)] px-4 text-[13.5px] font-bold text-white transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Download className="size-4" /> Download {item.original.filename.split(".").pop()?.toUpperCase()}
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * A whole family at once: every style set in your text, one row each.
 * Shown above a font family's folder; clicking a row opens that style.
 */
export function FontFamilyTester({ styles, onOpen }: { styles: MediaItem[]; onOpen: (i: number) => void }) {
  const t = useTester();
  const text = t.text || SAMPLE;
  useEffect(() => {
    styles.forEach((s) => void loadFont(s).catch(() => {}));
  }, [styles]);
  const transform = t.textCase === "upper" ? "uppercase" : t.textCase === "lower" ? "lowercase" : "none";
  return (
    <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/8 px-5 py-4">
        <input
          value={t.text}
          onChange={(e) => setTester({ text: e.target.value })}
          placeholder="Type to preview every style"
          aria-label="Preview text"
          className="h-11 min-w-[220px] flex-[2] rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white outline-none placeholder:text-white/35 focus-visible:border-accent"
        />
        <Slider label="Size" value={Math.min(t.size, 140)} min={16} max={140} step={1} onChange={(size) => setTester({ size })} format={(v) => `${v}px`} />
        <div className="flex items-center gap-1 rounded-2xl bg-white/[0.06] p-1">
          <Chip active={t.textCase === "as-typed"} onClick={() => setTester({ textCase: "as-typed" })} label="As typed">
            Aa
          </Chip>
          <Chip active={t.textCase === "upper"} onClick={() => setTester({ textCase: "upper" })} label="Uppercase">
            AA
          </Chip>
          <Chip active={t.textCase === "lower"} onClick={() => setTester({ textCase: "lower" })} label="Lowercase">
            aa
          </Chip>
        </div>
      </div>
      <ul className="divide-y divide-white/8">
        {styles.map((s, i) => (
          <li key={s.slug}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              data-cursor="view"
              data-cursor-label="Test"
              className="group flex w-full flex-col items-start gap-2 px-5 py-5 text-left transition-colors hover:bg-white/[0.04] sm:px-6"
            >
              <span className="flex w-full items-center gap-3 text-[12.5px] font-bold text-white/45">
                <span className="text-white/80">{s.font?.style ?? s.title}</span>
                <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">Open tester →</span>
              </span>
              <span
                className="block w-full truncate text-white transition-colors group-hover:text-accent-text"
                style={{ fontFamily: `"${fontFamilyName(s)}", system-ui, sans-serif`, fontSize: Math.min(t.size, 140), lineHeight: 1.12, letterSpacing: `${t.tracking}em`, textTransform: transform }}
              >
                {text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
