"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type AllHTMLAttributes,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { buildGlassMaps, supportsLiquidGlass, type GlassMaps } from "@/lib/liquid-glass";
import { cn } from "@/lib/cn";
import { usePreferences } from "@/lib/preferences";

interface GlassOptions {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  /** Corner radius in px (matches the element's border-radius). */
  radius?: number;
  bezel?: number;
  thickness?: number;
  /** Frost blur applied before refraction (px). */
  blur?: number;
  saturation?: number;
  specular?: number;
  /** Tint layered over the glass. */
  tint?: string;
  /** Stronger shadow and rim for floating chrome. */
  elevated?: boolean;
}

type LiquidGlassProps = GlassOptions & Omit<AllHTMLAttributes<HTMLElement>, keyof GlassOptions>;

const subscribe = () => () => {};

/** Keeps one colour channel of an image (for chromatic dispersion). */
const CHANNEL = {
  r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
};

/**
 * Apple-style liquid glass, as an SVG filter used as backdrop-filter in
 * Chromium (a frosted fallback elsewhere). The backdrop is refracted at the
 * curved rim with each colour channel bent slightly differently, like real
 * dispersion, and the rim highlight is the backdrop itself brightened, so
 * the glass picks up the colours behind it rather than glowing white.
 */
export const LiquidGlass = forwardRef<HTMLElement, LiquidGlassProps>(function LiquidGlass(
  {
    children,
    className,
    style,
    as: Tag = "div",
    radius = 24,
    bezel = 18,
    thickness = 42,
    blur = 0.6,
    saturation = 1.5,
    specular = 0.6,
    tint = "rgb(12 8 16 / 0.12)",
    elevated,
    ...rest
  },
  ref,
) {
  const el = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => el.current!);
  const id = useId().replace(/:/g, "");
  const filterId = `lg-${id}`;
  const lofi = usePreferences().quality === "lofi";
  // LoFi swaps the refraction filter for a plain frosted blur.
  const liquid = useSyncExternalStore(subscribe, supportsLiquidGlass, () => false) && !lofi;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [maps, setMaps] = useState<GlassMaps | null>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || !liquid) return;
    const measure = () => {
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (s && Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [liquid]);

  useEffect(() => {
    if (!size || !liquid) return;
    // Map generation is cheap but synchronous; defer to an idle frame.
    const handle = requestAnimationFrame(() => setMaps(buildGlassMaps({ width: size.w, height: size.h, radius, bezel, thickness, specular })));
    return () => cancelAnimationFrame(handle);
  }, [size, liquid, radius, bezel, thickness, specular]);

  const active = liquid && maps && size;
  const backdrop = active ? `url(#${filterId})` : `blur(${Math.max(14, blur * 12)}px) saturate(${saturation})`;

  return (
    <Tag
      ref={el}
      className={cn("liquid-glass relative isolate", elevated && "liquid-glass-elevated", className)}
      style={{ ...style, borderRadius: radius, backdropFilter: backdrop, WebkitBackdropFilter: active ? undefined : backdrop, background: tint }}
      {...rest}
    >
      {active && (
        <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} colorInterpolationFilters="sRGB">
          <filter id={filterId} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="frost" />
            <feImage href={maps.displacement} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="frost" in2="map" scale={maps.scale * 0.92} xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feDisplacementMap in="frost" in2="map" scale={maps.scale} xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feDisplacementMap in="frost" in2="map" scale={maps.scale * 1.08} xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="dr" type="matrix" values={CHANNEL.r} result="cr" />
            <feColorMatrix in="dg" type="matrix" values={CHANNEL.g} result="cg" />
            <feColorMatrix in="db" type="matrix" values={CHANNEL.b} result="cb" />
            <feBlend in="cr" in2="cg" mode="screen" result="crg" />
            <feBlend in="crg" in2="cb" mode="screen" result="refracted" />
            <feColorMatrix in="refracted" type="saturate" values={String(saturation)} result="vivid" />
            {/* Rim light: the refracted backdrop, brightened, shown only where the mask says. */}
            <feComponentTransfer in="vivid" result="lit">
              <feFuncR type="linear" slope="1.45" intercept="0.05" />
              <feFuncG type="linear" slope="1.45" intercept="0.05" />
              <feFuncB type="linear" slope="1.45" intercept="0.05" />
            </feComponentTransfer>
            <feImage href={maps.specular} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="rim" />
            <feComposite in="lit" in2="rim" operator="in" result="glint" />
            <feComposite in="glint" in2="vivid" operator="over" />
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
});
