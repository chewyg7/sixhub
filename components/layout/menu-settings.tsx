"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Feather, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { resetPreferences, setPreferences, usePreferences, type MotionPref, type QualityPref } from "@/lib/preferences";
import { CLOCK_MODES, ZONES, type ClockMode } from "@/lib/launch";
import { useClockMode, useLaunchZone } from "@/components/launch/use-launch";

const QUALITY: { value: QualityPref; label: string; icon: typeof Sparkles; note: string }[] = [
  { value: "hifi", label: "HiFi", icon: Sparkles, note: "Every effect: liquid glass, depth and ambient light." },
  { value: "lofi", label: "LoFi", icon: Feather, note: "Lighter on your GPU and battery. Same site, fewer effects." },
];

/** The HiFi / LoFi switch: a pill that slides between the two. */
export function QualitySwitch({ className }: { className?: string }) {
  const { quality } = usePreferences();
  const current = QUALITY.find((q) => q.value === quality) ?? QUALITY[0];
  return (
    <div className={className}>
      <div role="radiogroup" aria-label="Experience" className="relative grid h-12 w-[220px] grid-cols-2 rounded-full bg-white/[0.07] p-1 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <span
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-[transform,background] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
            quality === "lofi" ? "translate-x-full bg-white" : "translate-x-0 bg-[image:var(--sunset)] shadow-[0_8px_24px_-8px_rgb(255_79_163/0.9)]",
          )}
        />
        {QUALITY.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={quality === value}
            onClick={() => setPreferences({ quality: value })}
            className={cn(
              "relative z-10 flex items-center justify-center gap-2 rounded-full text-[14.5px] font-bold transition-colors duration-300",
              quality === value ? (value === "lofi" ? "text-[#140c18]" : "text-white") : "text-white/60 hover:text-white",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <p className="mt-2 max-w-[260px] text-[13px] text-white/50">{current.note}</p>
    </div>
  );
}

function Row({ label, hint, children, stack }: { label: string; hint?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={cn("flex gap-4 py-3.5", stack ? "flex-col" : "items-center justify-between")}>
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-white">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] text-white/50">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300", checked ? "bg-accent" : "bg-white/15")}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-2xl bg-white/[0.06] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 flex-1 rounded-xl px-3 text-[13.5px] font-bold whitespace-nowrap transition-colors duration-300",
            value === o.value ? "bg-white text-[#140c18]" : "text-white/60 hover:bg-white/8 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Site settings for this visitor, kept in their browser. Opens over the menu. */
export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePreferences();
  const [mode, setMode] = useClockMode();
  const [tz, setZone, local] = useLaunchZone();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(el, { xPercent: 104, opacity: 0.4 }, { xPercent: 0, opacity: 1, duration: 0.8, ease: "expo.out" });
      gsap.fromTo(el.querySelectorAll("[data-row]"), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.035, ease: "expo.out", delay: 0.1 });
    }
    el?.querySelector<HTMLElement>("button")?.focus();
    // Escape closes the panel first, not the whole menu.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div aria-hidden className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-label="Settings"
        className="absolute top-[92px] right-3 bottom-3 z-30 flex w-[min(440px,calc(100%-24px))] sm:top-[100px] sm:right-5 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[rgb(20_14_26/0.92)] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)] backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="display text-[28px]">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="flex size-10 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15">
            <X className="size-5" />
          </button>
        </div>
        <div className="no-scrollbar flex-1 divide-y divide-white/8 overflow-y-auto px-6 pb-4" data-lenis-prevent>
          <div data-row>
            <Row label="Experience" stack>
              <QualitySwitch />
            </Row>
          </div>
          <div data-row>
            <Row label="Motion" hint="Follow your device, or override it here." stack>
              <Segmented<MotionPref>
                label="Motion"
                value={prefs.motion}
                onChange={(motion) => setPreferences({ motion })}
                options={[
                  { value: "system", label: "Device" },
                  { value: "reduced", label: "Reduced" },
                  { value: "full", label: "Full" },
                ]}
              />
            </Row>
          </div>
          <div data-row>
            <Row label="Custom cursor" hint="The glass cursor (mouse only).">
              <Switch label="Custom cursor" checked={prefs.cursor} onChange={(cursor) => setPreferences({ cursor })} />
            </Row>
          </div>
          <div data-row>
            <Row label="Smooth scrolling" hint="Inertia when you scroll with a wheel.">
              <Switch label="Smooth scrolling" checked={prefs.smoothScroll} onChange={(smoothScroll) => setPreferences({ smoothScroll })} />
            </Row>
          </div>
          <div data-row>
            <Row label="Opening animation" hint="Plays once per visit.">
              <Switch label="Opening animation" checked={prefs.intro} onChange={(intro) => setPreferences({ intro })} />
            </Row>
          </div>
          <div data-row>
            <Row label="Launch confetti" hint="Celebrate when the game unlocks.">
              <Switch label="Launch confetti" checked={prefs.confetti} onChange={(confetti) => setPreferences({ confetti })} />
            </Row>
          </div>
          <div data-row>
            <Row label="Countdown shows" stack>
              <Segmented<ClockMode> label="Countdown shows" value={mode} onChange={setMode} options={CLOCK_MODES.map((m) => ({ value: m.mode, label: m.label }))} />
            </Row>
          </div>
          <div data-row>
            <Row label="Count down to" hint="Whose midnight the countdown uses." stack>
              <select
                value={tz && tz !== local ? tz : ""}
                onChange={(e) => setZone(e.target.value || null)}
                aria-label="Count down to"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[14.5px] font-medium text-white outline-none focus-visible:border-accent"
              >
                <option value="" className="bg-[#140c18]">
                  My time zone{local ? ` (${local.replace(/_/g, " ")})` : ""}
                </option>
                {ZONES.map((z) => (
                  <option key={z.tz} value={z.tz} className="bg-[#140c18]">
                    {z.city}, {z.country}
                  </option>
                ))}
              </select>
            </Row>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
          <p className="text-[12.5px] text-white/40">Saved in this browser.</p>
          <button
            type="button"
            onClick={() => {
              resetPreferences();
              setMode("days");
              setZone(null);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/8 px-4 text-[13.5px] font-bold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <RotateCcw className="size-4" /> Reset
          </button>
        </div>
      </div>
    </>
  );
}
