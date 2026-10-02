"use client";

import type { ReactNode } from "react";
import type { MediaItem } from "@/types/content";
import { useLightbox } from "./lightbox-context";

/** Any element that opens the lightbox for a set of media. */
export function LightboxTrigger({ items, index = 0, children, className, label }: { items: MediaItem[]; index?: number; children: ReactNode; className?: string; label?: string }) {
  const { open } = useLightbox();
  return (
    <button type="button" className={className} aria-label={label} onClick={() => open(items, index)}>
      {children}
    </button>
  );
}
