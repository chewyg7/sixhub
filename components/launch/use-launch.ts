"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CLOCK_MODES, launchInstant, localTimeZone, ZONES, type ClockMode, type Zone } from "@/lib/launch";
import type { SiteSettings } from "@/types/content";

/* ------------------------------------------------------------------ */
/* One shared 1 s ticker for every clock on the page                   */
/* ------------------------------------------------------------------ */

let nowValue = 0;
const tickListeners = new Set<() => void>();
let tickTimer: number | null = null;

function subscribeTick(cb: () => void) {
  tickListeners.add(cb);
  if (tickTimer === null) {
    nowValue = Date.now();
    // Align ticks to the wall-clock second so every digit flips together.
    const start = () => {
      nowValue = Date.now();
      tickListeners.forEach((l) => l());
    };
    const t0 = window.setTimeout(() => {
      start();
      tickTimer = window.setInterval(start, 1000);
    }, 1000 - (Date.now() % 1000));
    tickTimer = t0;
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && tickTimer !== null) {
      window.clearTimeout(tickTimer);
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

/** Current time, ticking once a second (null during server render). */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeTick,
    // Cached until the next tick: getSnapshot must return the same value between ticks.
    () => (nowValue ||= Date.now()),
    () => null,
  );
}

/* ------------------------------------------------------------------ */
/* Saved preferences: time zone and count mode                         */
/* ------------------------------------------------------------------ */

const TZ_KEY = "gh:launch-tz";
const MODE_KEY = "gh:launch-mode";
const prefListeners = new Set<() => void>();
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
  prefListeners.forEach((l) => l());
};
const subscribePrefs = (cb: () => void) => {
  prefListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    prefListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

const isZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Selected time zone: the viewer's own unless they picked another. */
export function useLaunchZone(): [string | null, (tz: string | null) => void, string | null] {
  const saved = useSyncExternalStore(subscribePrefs, () => read(TZ_KEY), () => null);
  const local = useSyncExternalStore(subscribePrefs, localTimeZone, () => null);
  const tz = saved && isZone(saved) ? saved : local;
  return [tz, (v) => write(TZ_KEY, v && v !== local ? v : null), local];
}

export function useClockMode(): [ClockMode, (m: ClockMode) => void] {
  const saved = useSyncExternalStore(subscribePrefs, () => read(MODE_KEY), () => null);
  const mode = (CLOCK_MODES.some((m) => m.mode === saved) ? saved : "days") as ClockMode;
  return [mode, (m) => write(MODE_KEY, m === "days" ? null : m)];
}

/* ------------------------------------------------------------------ */
/* Launch state                                                        */
/* ------------------------------------------------------------------ */

export interface ZoneLaunch extends Zone {
  at: number;
}

export interface LaunchState {
  ready: boolean;
  now: number;
  tz: string;
  localTz: string;
  target: number;
  remaining: number;
  /** The selected zone has launched (or the owner forced the celebration). */
  launched: boolean;
  /** Every zone sorted by launch instant. */
  zones: ZoneLaunch[];
  liveCount: number;
  first: ZoneLaunch;
  last: ZoneLaunch;
}

/** Launch state for the release date in settings, honouring the owner's override. */
export function useLaunchState(release: SiteSettings["release"], launchMode: SiteSettings["launchMode"], preview = false): LaunchState | null {
  const now = useNow();
  const [tz, , localTz] = useLaunchZone();
  const zones = useMemo(() => {
    const list = [...ZONES];
    if (localTz && !list.some((z) => z.tz === localTz)) list.push({ tz: localTz, city: localTz.split("/").pop()!.replace(/_/g, " "), country: "Your time zone" });
    return list.map((z) => ({ ...z, at: launchInstant(release.date, z.tz) })).sort((a, b) => a.at - b.at || a.city.localeCompare(b.city));
  }, [release.date, localTz]);

  if (now === null || !tz || !localTz) return null;
  const target = launchInstant(release.date, tz);
  const forced = launchMode === "launched" || preview;
  const remaining = forced ? 0 : launchMode === "countdown" ? Math.max(1000, target - now) : target - now;
  return {
    ready: true,
    now,
    tz,
    localTz,
    target,
    remaining,
    launched: forced || (launchMode !== "countdown" && remaining <= 0),
    zones,
    liveCount: forced ? zones.length : zones.filter((z) => z.at <= now).length,
    first: zones[0],
    last: zones[zones.length - 1],
  };
}
