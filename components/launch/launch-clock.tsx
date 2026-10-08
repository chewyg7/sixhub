"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe2, PartyPopper } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { breakdown, CLOCK_MODES, formatInZone, humanSpan, zoneLabel, type ClockMode } from "@/lib/launch";
import { cn } from "@/lib/cn";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { RollingNumber } from "./rolling-number";
import { ZonePanel } from "./zone-panel";
import { fireConfetti } from "./confetti";
import { useClockMode, useLaunchZone, type LaunchState } from "./use-launch";

/** Live hundredths of a second, written straight to the DOM every frame (no re-renders). */
function Hundredths({ target, up }: { target: number; up: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const ms = Math.abs(target - Date.now());
      const cs = up ? Math.floor((ms % 1000) / 10) : Math.floor((ms % 1000) / 10);
      if (ref.current) ref.current.textContent = `.${String(cs).padStart(2, "0")}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, up]);
  return <span ref={ref} aria-hidden className="ml-1 w-[1.6em] text-[0.42em] text-white/60 tabular-nums" />;
}

/** Segmented mode switcher with a pill that glides to the active option. */
function ModeSwitch({ mode, onChange }: { mode: ClockMode; onChange: (m: ClockMode) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-mode="${mode}"]`);
    if (!el || !pill.current) return;
    gsap.to(pill.current, { x: el.offsetLeft, width: el.offsetWidth, duration: prefersReducedMotion() ? 0 : 0.55, ease: "expo.out" });
  }, [mode]);
  return (
    <div ref={wrap} role="radiogroup" aria-label="Count in" className="no-scrollbar relative flex overflow-x-auto rounded-full bg-black/25 p-1">
      <span ref={pill} aria-hidden className="absolute top-1 bottom-1 left-0 rounded-full bg-white shadow-[0_6px_20px_-6px_rgb(255_255_255/0.6)]" />
      {CLOCK_MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          role="radio"
          aria-checked={m.mode === mode}
          data-mode={m.mode}
          onClick={() => onChange(m.mode)}
          className={cn("relative z-10 h-8 shrink-0 rounded-full px-3 text-[13px] font-bold transition-colors duration-300 sm:px-3.5", m.mode === mode ? "text-[#140c18]" : "text-white/60 hover:text-white")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** The digits row. Re-keyed per mode so a mode change plays a fresh entrance. */
function Units({ ms, mode, up, now, target }: { ms: number; mode: ClockMode; up: boolean; now: number; target: number }) {
  const units = breakdown(ms, mode, now);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!row.current || prefersReducedMotion()) return;
    gsap.fromTo(row.current.children, { yPercent: 60, opacity: 0, filter: "blur(8px)" }, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, stagger: 0.06, ease: "expo.out" });
  }, [mode]);
  return (
    <div ref={row} className="flex items-start">
      {units.map((u, i) => (
        <div key={u.key} className={cn("group flex flex-col", i > 0 && "border-l border-white/12 pl-3 sm:pl-5", i < units.length - 1 && "pr-3 sm:pr-5")}>
          <span className="display-xl flex items-baseline text-[44px] leading-none text-white transition-transform duration-500 group-hover:-translate-y-1 sm:text-[64px]">
            <RollingNumber value={u.value} pad={u.pad} direction={up ? "up" : "down"} />
            {mode === "seconds" && <Hundredths target={target} up={up} />}
          </span>
          <span className="mt-1.5 text-[12px] font-medium text-white/55 sm:text-[13px]">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LaunchClock({ state, className }: { state: LaunchState; className?: string }) {
  const [mode, setMode] = useClockMode();
  const [, setZone] = useLaunchZone();
  const [panel, setPanel] = useState(false);
  const zone = state.zones.find((z) => z.tz === state.tz) ?? { ...zoneLabel(state.tz), tz: state.tz, at: state.target };
  const elapsed = state.now - state.target;

  return (
    <>
      <LiquidGlass elevated radius={30} bezel={20} thickness={42} tint="rgb(14 9 18 / 0.32)" className={cn("relative overflow-hidden px-5 pt-4 pb-5 sm:px-7 sm:pt-5 sm:pb-6", className)}>
        {/* Header: where we're counting to */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {state.launched ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12.5px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> Out now
            </span>
          ) : state.liveCount > 0 ? (
            <button type="button" onClick={() => setPanel(true)} className="inline-flex items-center gap-2 rounded-full bg-accent/25 px-3 py-1 text-[12.5px] font-bold text-accent-text transition-colors hover:bg-accent/35">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Live in {state.liveCount} {state.liveCount === 1 ? "place" : "places"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPanel(true)}
            data-cursor="view"
            data-cursor-label="Zones"
            className="group inline-flex items-center gap-1.5 text-[14px] text-white/75 transition-colors hover:text-white"
            aria-haspopup="dialog"
          >
            <Globe2 className="size-4 text-accent-text transition-transform duration-500 group-hover:rotate-[30deg]" />
            {state.launched ? "Unlocked in" : "Unlocks in"} <span className="font-bold text-white">{zone.city}</span>
            <ChevronDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" />
          </button>
          <span className="text-[13px] text-white/45">{formatInZone(state.target, state.tz)}</span>
        </div>

        {/* Digits */}
        <div className="mt-3" role="timer" aria-live="off" aria-label={state.launched ? `Out now. Live for ${humanSpan(elapsed)}.` : `${humanSpan(state.remaining)} until launch in ${zone.city}`}>
          {state.launched && elapsed <= 0 ? (
            // Celebration forced (or previewed) before the real date: nothing to count yet.
            <p className="display-xl text-[44px] leading-none text-white sm:text-[64px]">
              Welcome to <span className="text-accent">Leonida</span>
            </p>
          ) : state.launched ? (
            <>
              <p className="text-[13px] font-medium text-white/55">Leonida has been live for</p>
              <div className="mt-1">
                <Units key="up" ms={Math.max(0, elapsed)} mode={mode} up now={state.target} target={state.target} />
              </div>
            </>
          ) : (
            <Units key="down" ms={state.remaining} mode={mode} up={false} now={state.now} target={state.target} />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {!(state.launched && elapsed <= 0) && <ModeSwitch mode={mode} onChange={setMode} />}
          {state.launched && (
            <button
              type="button"
              onClick={() => fireConfetti(1.2)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[image:var(--sunset)] px-4 text-[14px] font-bold text-white transition-transform hover:scale-[1.04] active:scale-95"
            >
              <PartyPopper className="size-4" /> Celebrate
            </button>
          )}
        </div>

        {/* A sweep across the bottom every second: the clock's heartbeat */}
        <span key={Math.floor(state.now / 1000)} aria-hidden className="tick-sweep absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[image:var(--sunset)]" />
      </LiquidGlass>
      <ZonePanel open={panel} onClose={() => setPanel(false)} state={state} onPick={setZone} />
    </>
  );
}
