"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Read a browser-only value without hydration mismatches (server gets `fallback`). */
export function useClientValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => fallback);
}

export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

export const usePipSupported = () => useClientValue(() => typeof document !== "undefined" && Boolean(document.pictureInPictureEnabled), false);

export const useIsMac = () => useClientValue(() => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), false);
