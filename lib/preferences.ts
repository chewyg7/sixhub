"use client";

import { useSyncExternalStore } from "react";
import { PREFS_KEY } from "./preferences-script";

export type ThemePref = "dark" | "light" | "system";
export type MotionPref = "system" | "reduced" | "full";
export interface Preferences {
  theme: ThemePref;
  motion: MotionPref;
}

const DEFAULTS: Preferences = { theme: "dark", motion: "system" };

let prefs: Preferences | null = null;
const listeners = new Set<() => void>();

function read(): Preferences {
  if (prefs) return prefs;
  try {
    prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    prefs = DEFAULTS;
  }
  return prefs!;
}

function apply(p: Preferences) {
  const d = document.documentElement;
  const theme = p.theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : p.theme;
  d.dataset.theme = theme;
  if (p.motion === "system") delete d.dataset.motion;
  else d.dataset.motion = p.motion;
}

export function setPreferences(patch: Partial<Preferences>) {
  prefs = { ...read(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  apply(prefs);
  listeners.forEach((l) => l());
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const mql = matchMedia("(prefers-color-scheme: light)");
      const onScheme = () => read().theme === "system" && apply(read());
      mql.addEventListener("change", onScheme);
      return () => {
        listeners.delete(l);
        mql.removeEventListener("change", onScheme);
      };
    },
    read,
    () => DEFAULTS,
  );
}
