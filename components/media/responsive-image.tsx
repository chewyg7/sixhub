"use client";

import type { ImgHTMLAttributes } from "react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { smallestVariant, srcSetFor } from "@/lib/media/variants";

type ImageSource = Pick<MediaItem, "variants" | "alt"> & Partial<Pick<MediaItem, "width" | "height">>;

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  item: ImageSource;
  /** `sizes` attribute; keep accurate so the browser picks the right variant. */
  sizes: string;
  priority?: boolean;
  fit?: "cover" | "contain";
}

/**
 * Renders a display variant — never the original — using native srcset
 * so the browser selects the smallest adequate file for layout and DPR.
 * Fades in on load; the parent supplies the blur/colour placeholder.
 */
export function ResponsiveImage({ item, sizes, priority, fit = "cover", className, alt, ...rest }: Props) {
  const fallback = smallestVariant(item, 960);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variants are pre-generated; see lib/content
    <img
      src={fallback?.url}
      srcSet={srcSetFor(item)}
      sizes={sizes}
      alt={alt ?? item.alt}
      width={item.width}
      height={item.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      ref={(el) => {
        // Images cached by the browser can finish before hydration attaches onLoad.
        if (el?.complete && el.naturalWidth > 0) el.dataset.loaded = "true";
      }}
      onLoad={(e) => {
        e.currentTarget.dataset.loaded = "true";
      }}
      className={cn("fade-in-img h-full w-full", fit === "cover" ? "object-cover" : "object-contain", className)}
      {...rest}
    />
  );
}
