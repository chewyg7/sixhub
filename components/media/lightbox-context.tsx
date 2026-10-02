"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MediaItem } from "@/types/content";

// The lightbox (zoom, video player, metadata) is only downloaded when first opened.
const Lightbox = dynamic(() => import("./lightbox").then((m) => m.Lightbox), { ssr: false });

interface LightboxState {
  items: MediaItem[];
  index: number;
}

interface LightboxApi {
  open: (items: MediaItem[], index: number) => void;
  close: () => void;
}

const Ctx = createContext<LightboxApi>({ open: () => {}, close: () => {} });

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LightboxState | null>(null);
  const open = useCallback((items: MediaItem[], index: number) => setState({ items, index }), []);
  const close = useCallback(() => setState(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {state && <Lightbox items={state.items} index={state.index} onIndexChange={(index) => setState((s) => (s ? { ...s, index } : s))} onClose={close} />}
    </Ctx.Provider>
  );
}

export const useLightbox = () => useContext(Ctx);
