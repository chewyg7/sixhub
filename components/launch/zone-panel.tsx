"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, LocateFixed, Search, X } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { formatInZone, formatOffset, humanSpan, tzOffsetMinutes } from "@/lib/launch";
import { lockScroll, useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { cn } from "@/lib/cn";
import type { LaunchState, ZoneLaunch } from "./use-launch";

/**
 * "Launch around the world": every time zone on one 25-hour wave, plus a
 * searchable list. Picking a zone switches the countdown to it.
 */
export function ZonePanel({ open, onClose, state, onPick }: { open: boolean; onClose: () => void; state: LaunchState; onPick: (tz: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useFocusTrap(ref, open, searchRef);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const el = ref.current;
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(el, { y: 40, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "expo.out" });
      gsap.fromTo(el.querySelectorAll("[data-zone-row]"), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.012, ease: "expo.out", delay: 0.1 });
      gsap.fromTo(el.querySelectorAll("[data-wave-dot]"), { scale: 0 }, { scale: 1, duration: 0.8, stagger: 0.008, ease: "back.out(3)", delay: 0.15 });
    }
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.zones.filter((z) => !needle || `${z.city} ${z.country} ${z.tz} ${formatOffset(tzOffsetMinutes(z.tz, z.at))}`.toLowerCase().includes(needle));
  }, [q, state.zones]);

  if (!open) return null;

  const local = state.zones.find((z) => z.tz === state.localTz);
  const span = state.last.at - state.first.at || 1;
  const pos = (at: number) => ((at - state.first.at) / span) * 100;
  const nowPos = Math.min(100, Math.max(0, pos(state.now)));
  const offsets = new Set(state.zones.map((z) => tzOffsetMinutes(z.tz, z.at))).size;
  const pick = (z: ZoneLaunch) => {
    onPick(z.tz === state.localTz ? null : z.tz);
    onClose();
  };

  // Group zones that unlock at the same instant into one dot on the wave.
  const dots = [...state.zones.reduce((m, z) => m.set(z.at, [...(m.get(z.at) ?? []), z]), new Map<number, ZoneLaunch[]>())];

  return createPortal(
    <div className="fixed inset-0 z-[950] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zones-title"
        tabIndex={-1}
        className="relative flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-[#120d18]/95 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)] outline-none sm:rounded-[32px]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8">
          <div>
            <h2 id="zones-title" className="display-xl text-[40px] text-white sm:text-[54px]">
              Launch around the world
            </h2>
            <p className="mt-2 max-w-lg text-[14.5px] leading-relaxed text-white/65">
              Grand Theft Auto VI unlocks at midnight local time, rolling through {offsets} time zones over {Math.round(span / 3600000)} hours. Pick a place to count down to it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition-colors hover:bg-white/15">
            <X className="size-5" />
          </button>
        </div>

        {/* The wave: first unlock on the left, last on the right */}
        <div className="px-6 pt-7 sm:px-8">
          <div className="relative h-14">
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/10" />
            <div className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[image:var(--sunset)] transition-[width] duration-1000" style={{ width: `${nowPos}%` }} />
            {dots.map(([at, zs]) => {
              const live = at <= state.now;
              const selected = zs.some((z) => z.tz === state.tz);
              const mine = zs.some((z) => z.tz === state.localTz);
              return (
                <button
                  key={at}
                  type="button"
                  data-wave-dot
                  onClick={() => pick(zs.find((z) => z.tz === state.localTz) ?? zs[0])}
                  title={`${zs.map((z) => z.city).join(", ")} · ${formatInZone(at, state.localTz)} your time`}
                  aria-label={`${zs.map((z) => z.city).join(", ")}, unlocks ${formatInZone(at, state.localTz)} your time`}
                  className={cn(
                    "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[transform,background-color,box-shadow] duration-300 hover:scale-150",
                    selected ? "size-4 bg-white shadow-[0_0_0_5px_rgb(255_79_163/0.45)]" : mine ? "size-3.5 bg-accent-2" : live ? "size-2.5 bg-accent" : "size-2.5 bg-white/35",
                  )}
                  style={{ left: `${pos(at)}%` }}
                />
              );
            })}
            {state.now >= state.first.at && state.now <= state.last.at && (
              <span className="pointer-events-none absolute -top-1 -translate-x-1/2 text-[11px] font-bold text-accent-text" style={{ left: `${nowPos}%` }}>
                Now
              </span>
            )}
          </div>
          <div className="flex justify-between text-[12px] text-white/50">
            <span>
              First: {state.first.city} ({formatOffset(tzOffsetMinutes(state.first.tz, state.first.at))})
            </span>
            <span>
              Last: {state.last.city} ({formatOffset(tzOffsetMinutes(state.last.tz, state.last.at))})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 pt-6 pb-3 sm:px-8">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/40" />
            <input
              ref={searchRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a city, country or UTC offset"
              className="h-12 w-full rounded-full border border-white/10 bg-white/5 pr-4 pl-11 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-white/8 px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/15"
          >
            <LocateFixed className="size-4" /> <span className="hidden sm:inline">My time zone</span>
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 sm:px-5" data-lenis-prevent>
          {list.map((z) => {
            const live = z.at <= state.now;
            const selected = z.tz === state.tz;
            const vsYou = local ? z.at - local.at : 0;
            return (
              <li key={z.tz} data-zone-row>
                <button
                  type="button"
                  onClick={() => pick(z)}
                  aria-current={selected || undefined}
                  className={cn(
                    "group grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 rounded-2xl px-4 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]",
                    selected ? "bg-accent/15" : "hover:bg-white/5",
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[15.5px] font-bold text-white">
                      {z.city}
                      {z.tz === state.localTz && <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-[11px] font-bold text-accent-2">You</span>}
                      {selected && <Check className="size-4 text-accent-text" />}
                    </span>
                    <span className="block truncate text-[13px] text-white/50">
                      {z.country} · {formatOffset(tzOffsetMinutes(z.tz, z.at))}
                    </span>
                  </span>
                  <span className="col-start-1 row-start-2 text-[13px] text-white/60 sm:col-start-2 sm:row-start-1">
                    {formatInZone(z.at, state.localTz)} <span className="text-white/35">your time</span>
                    {local && z.tz !== state.localTz && vsYou !== 0 && (
                      <span className="block text-[12px] text-white/40">
                        {humanSpan(vsYou)} {vsYou < 0 ? "before" : "after"} you
                      </span>
                    )}
                  </span>
                  <span className="row-span-2 text-right sm:row-span-1">
                    {live ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-[12.5px] font-bold text-accent-text">
                        <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Live
                      </span>
                    ) : (
                      <span className="text-[13px] font-bold text-white/80 tabular-nums">in {humanSpan(z.at - state.now)}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-4 py-10 text-center text-[14px] text-white/50">No time zones match “{q}”.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
