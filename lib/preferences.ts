"use client";

import { useSyncExternalStore } from "react";
import { PREFS_KEY } from "./preferences-script";

export type ThemePref = "dark" | "light" | "system";
export type MotionPref = "system" | "reduced" | "full";
/** HiFi: every effect (liquid glass refraction, parallax, ambient light, smooth scroll). LoFi: the same site, lighter on the GPU and battery. */
export type QualityPref = "hifi" | "lofi";
export interface Preferences {
  theme: ThemePref;
  motion: MotionPref;
  quality: QualityPref;
  /** The custom cursor (mouse only). */
  cursor: boolean;
  /** Inertia smooth scrolling. */
  smoothScroll: boolean;
  /** The opening animation, once per visit. */
  intro: boolean;
  /** Fire confetti when the game launches. */
  confetti: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: "dark", motion: "system", quality: "hifi", cursor: true, smoothScroll: true, intro: true, confetti: true };

let prefs: Preferences | null = null;
const listeners = new Set<() => void>();

/** Current preferences (defaults on the server). */
export function getPreferences(): Preferences {
  if (prefs) return prefs;
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    prefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    prefs = DEFAULT_PREFERENCES;
  }
  return prefs!;
}

/** True when the visitor picked LoFi. */
export function prefersLofi(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.quality === "lofi";
}

function apply(p: Preferences) {
  const d = document.documentElement;
  const theme = p.theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : p.theme;
  d.dataset.theme = theme;
  if (p.motion === "system") delete d.dataset.motion;
  else d.dataset.motion = p.motion;
  d.dataset.quality = p.quality;
}

export function setPreferences(patch: Partial<Preferences>) {
  prefs = { ...getPreferences(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  apply(prefs);
  listeners.forEach((l) => l());
}

export function resetPreferences() {
  setPreferences(DEFAULT_PREFERENCES);
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const mql = matchMedia("(prefers-color-scheme: light)");
      const onScheme = () => getPreferences().theme === "system" && apply(getPreferences());
      mql.addEventListener("change", onScheme);
      return () => {
        listeners.delete(l);
        mql.removeEventListener("change", onScheme);
      };
    },
    getPreferences,
    () => DEFAULT_PREFERENCES,
  );
}
