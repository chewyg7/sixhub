"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Download, Shuffle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  BACKGROUNDS,
  INITIAL_TEXTS,
  LABELS,
  LINE_STEP,
  MAIN_PLACEHOLDER,
  STYLES,
  TEXT_INPUT_PROPS,
  checkerboard,
  isColorStyle,
  styleThumb,
} from "./engine/config";
import { useGenerator, type FitBox } from "./use-generator";

/** A different sample word from the generator's list. */
function randomText(current: string): string {
  const pool = INITIAL_TEXTS.filter((t) => t !== current);
  return pool[Math.floor(Math.random() * pool.length)] ?? "LEONIDA";
}

/** Max characters per text layer (main / overlay / script). */
const MAX_LAYER_TEXT = 240;

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-35", checked && !disabled ? "bg-accent" : "bg-white/15")}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          checked && !disabled && "translate-x-5",
        )}
      />
    </button>
  );
}

function Row({ label, children, dim }: { label: string; children: ReactNode; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className={cn("text-[14.5px] font-bold transition-colors", dim ? "text-white/35" : "text-white/85")}>{label}</span>
      {children}
    </div>
  );
}

function Slider({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block py-2.5">
      <span className="mb-2 flex justify-between text-[14.5px] font-bold text-white/85">
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

function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[26px] border border-white/10 bg-white/[0.03] p-5 sm:p-6", className)}>
      {title && <h2 className="mb-3 text-[13px] font-bold tracking-[0.18em] text-white/45 uppercase">{title}</h2>}
      {children}
    </section>
  );
}

/**
 * Type anything and get it in the GTA VI title lettering. The preview is a
 * canvas fitted to the stage; Download exports the full-size PNG.
 */
export function TextGenerator() {
  const stage = useRef<HTMLDivElement>(null);
  const fitBox = useCallback((): FitBox | null => {
    const el = stage.current;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return { width: Math.max(1, el.clientWidth - padX), height: Math.max(1, el.clientHeight - padY) };
  }, []);
  // The refs come out separately so the rest of the controller reads as plain values.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- refs the old fixed-bar layout used
  const { viewCanvasRef, containerRef, bottomBarRef, ...c } = useGenerator(fitBox);
  const { scheduleRedraw } = c;

  // Redraw whenever the stage changes size.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => scheduleRedraw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleRedraw]);

  const colorStyle = isColorStyle(c.style);
  const imageBg = c.bgMode === "image";
  const layer = c.secondLayer;
  const shuffle = () => c.setText(randomText(c.text));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
      {/* Stage */}
      <div className="grid gap-4 lg:sticky lg:top-28">
        <div
          ref={stage}
          className="relative flex h-[42svh] min-h-[240px] items-center justify-center overflow-hidden rounded-[30px] border border-white/10 bg-[#0d0a12] p-4 sm:p-8 lg:h-[min(68vh,640px)]"
          style={c.bgMode === "none" ? checkerboard(28) : undefined}
        >
          <canvas ref={viewCanvasRef} className="block max-w-full" aria-label="Preview of your text in the GTA VI style" role="img" />
          {!c.fontReady && <span className="absolute inset-0 flex items-center justify-center text-[14px] text-white/45">Loading the lettering…</span>}
        </div>

        {/* Text + download */}
        <div className="flex flex-col gap-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
          <textarea
            aria-label="Text to render"
            rows={Math.min(4, Math.max(1, c.text.split("\n").length))}
            maxLength={MAX_LAYER_TEXT}
            value={c.text}
            onChange={(e) => {
              c.setText(e.target.value);
              scheduleRedraw();
            }}
            placeholder={MAIN_PLACEHOLDER}
            {...TEXT_INPUT_PROPS}
            className="min-h-14 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-5 py-3.5 text-[18px] leading-snug font-bold text-white uppercase outline-none placeholder:text-white/30 focus:border-accent"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={shuffle}
              aria-label="Random text"
              title="Random text"
              className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.07] text-white/75 transition-colors hover:bg-white/12 hover:text-white"
            >
              <Shuffle className="size-5" />
            </button>
            <button
              type="button"
              onClick={c.exportPNG}
              disabled={!c.hasArtwork}
              className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[image:var(--sunset)] px-7 text-[16px] font-bold text-white shadow-[0_12px_32px_-12px_rgb(255_79_163/0.9)] transition-transform duration-300 hover:scale-[1.03] active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:flex-none"
            >
              <Download className="size-5" /> Download PNG
            </button>
          </div>
        </div>
        <p className="px-2 text-[12.5px] text-white/40">Press Enter for a new line. Transparent backgrounds download as transparent PNGs.</p>
      </div>

      {/* Controls */}
      <div className="grid gap-4">
        <Panel title="Style">
          <div role="radiogroup" aria-label="Style" className="grid grid-cols-4 gap-2">
            {STYLES.map((s) => {
              const active = c.style === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    c.setStyleAutoCycle(false);
                    c.setStyle(s.key);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border px-1.5 pt-3 pb-2 transition-[border-color,background-color,opacity]",
                    active ? "border-accent bg-accent/10" : "border-white/10 opacity-60 hover:border-white/25 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- style thumbnail */}
                  <img src={c.asset(styleThumb(s, c.innerOutlineWhite))} alt="" className="h-9 w-full object-contain" draggable={false} />
                  <span className="text-[12.5px] font-bold">{s.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2">
            <Row label={LABELS.coverArt} dim={!colorStyle}>
              <Switch
                label={LABELS.coverArt}
                checked={c.innerOutlineWhite}
                disabled={!colorStyle}
                onChange={() => {
                  c.setStyleAutoCycle(false);
                  c.setInnerOutlineWhite((v) => !v);
                }}
              />
            </Row>
          </div>
        </Panel>

        {c.showPricedownControls && (
          <Panel title={layer?.kind === "script" ? "3D options" : "Overlay options"}>
            {layer && (
              <>
                <label className="block py-2">
                  <span className="mb-2 block text-[14.5px] font-bold text-white/85">{layer.label}</span>
                  <textarea
                    rows={2}
                    maxLength={MAX_LAYER_TEXT}
                    value={layer.text}
                    onChange={(e) => layer.setText(e.target.value)}
                    placeholder={layer.placeholder}
                    {...TEXT_INPUT_PROPS}
                    autoCapitalize={layer.uppercase ? "characters" : "sentences"}
                    className={cn(
                      "w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[15px] leading-snug text-white outline-none placeholder:text-white/30 focus:border-accent",
                      layer.uppercase && "uppercase",
                    )}
                  />
                </label>
                <Slider label={layer.sizeLabel} value={layer.size} display={`${layer.size}%`} min={layer.sizeMin} max={layer.sizeMax} step={1} onChange={layer.setSize} />
              </>
            )}
            <Row label={LABELS.interlock}>
              <Switch label={LABELS.interlock} checked={c.overlayInterlock} onChange={() => c.setOverlayInterlock((v) => !v)} />
            </Row>
            {c.showLineSpacingControls && (
              <Row label={LABELS.autoStep}>
                <Switch label={LABELS.autoStep} checked={c.overlayAutoStep} onChange={() => c.setOverlayAutoStep((v) => !v)} />
              </Row>
            )}
            {c.showLineSpacingControls && !c.overlayAutoStep && (
              <Slider
                label={LABELS.lineSpacing}
                value={c.overlayLineStep}
                display={`${c.overlayLineStep.toFixed(2)}×`}
                min={LINE_STEP.min}
                max={LINE_STEP.max}
                step={LINE_STEP.step}
                onChange={c.setOverlayLineStep}
              />
            )}
          </Panel>
        )}

        <Panel>
          <button
            type="button"
            onClick={() => c.setBackgroundsExpanded((v) => !v)}
            aria-expanded={c.backgroundsExpanded}
            aria-controls="vi-backgrounds"
            className="flex w-full items-center justify-between text-[13px] font-bold tracking-[0.18em] text-white/45 uppercase transition-colors hover:text-white/70"
          >
            {LABELS.backgrounds}
            <span className="flex items-center gap-2 tracking-normal normal-case">
              <span className="text-[13px] font-medium text-white/55">{imageBg ? BACKGROUNDS.find((b) => b.key === c.bgImageKey)?.label : LABELS.transparent}</span>
              <ChevronDown className={cn("size-4 transition-transform duration-300", c.backgroundsExpanded && "rotate-180")} />
            </span>
          </button>
          {c.backgroundsExpanded && (
            <div id="vi-backgrounds" className="mt-4">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => c.applyBackground(null)}
                  aria-pressed={c.selectedBackgroundKey === ""}
                  title={LABELS.transparent}
                  className={cn("relative block w-full overflow-hidden rounded-xl border-2 pt-[100%] transition-colors", c.selectedBackgroundKey === "" ? "border-accent" : "border-transparent hover:border-white/30")}
                >
                  <span className="absolute inset-0 rounded-[10px]" style={checkerboard(14)} />
                  <span className="sr-only">{LABELS.transparent}</span>
                </button>
                {BACKGROUNDS.map((bg) => {
                  const active = c.selectedBackgroundKey === bg.key;
                  return (
                    <button
                      key={bg.key}
                      type="button"
                      onClick={() => c.applyBackground(bg.key)}
                      aria-pressed={active}
                      title={bg.label}
                      className={cn("relative block w-full overflow-hidden rounded-xl border-2 pt-[100%] transition-colors", active ? "border-accent" : "border-transparent hover:border-white/30")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- background thumbnail */}
                      <img src={c.asset(bg.path)} alt={bg.label} loading="lazy" className="absolute inset-0 size-full rounded-[10px] object-cover" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <Row label={LABELS.fullBackground} dim={!imageBg}>
                  <Switch label={LABELS.fullBackground} checked={c.fullBackground} disabled={!imageBg} onChange={() => c.setFullBackground((v) => !v)} />
                </Row>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* iOS: long-press to save */}
      {c.saveOverlayUrl && (
        <div role="dialog" aria-modal="true" aria-label="Save image" className="fixed inset-0 z-[900] flex flex-col items-center justify-center gap-4 bg-black/85 p-6 backdrop-blur-sm">
          <p className="text-center text-[15px] text-white/90">
            Press and hold the image, then tap <span className="font-bold">“Add to Photos”</span>.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
          <img src={c.saveOverlayUrl} alt="Your generated text" className="max-h-[70vh] max-w-full rounded-xl border border-white/20" />
          <button type="button" onClick={c.closeSaveOverlay} className="h-11 rounded-full bg-white px-6 text-[15px] font-bold text-[#140c18]">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
