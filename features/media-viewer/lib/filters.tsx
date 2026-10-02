import type { Adjustments } from "../types";

export const SVG_FILTER_ID = "gh-viewer-fx";

/** Exposure (EV) and sharpness need an SVG filter; everything else is native CSS. */
export function needsSvgFilter(a: Adjustments) {
  return a.exposure !== 0 || a.sharpness > 0;
}

/** CSS filters that can also be applied to a canvas (ctx.filter) for exports. */
export function cssFilterParts(a: Adjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
  if (a.saturation !== 100) parts.push(`saturate(${a.saturation}%)`);
  if (a.grayscale > 0) parts.push(`grayscale(${a.grayscale}%)`);
  if (a.invert) parts.push("invert(100%)");
  return parts.join(" ");
}

export function buildFilter(a: Adjustments): string | undefined {
  const css = cssFilterParts(a);
  const svg = needsSvgFilter(a) ? `url(#${SVG_FILTER_ID})` : "";
  const f = [svg, css].filter(Boolean).join(" ");
  return f || undefined;
}

export function isDefaultAdjust(a: Adjustments) {
  return a.brightness === 100 && a.contrast === 100 && a.saturation === 100 && a.exposure === 0 && a.sharpness === 0 && a.grayscale === 0 && !a.invert;
}

/**
 * Hidden SVG holding the exposure + sharpen filter. Exposure is a linear
 * gain of 2^EV per channel; sharpening is an unsharp-style 3×3 kernel whose
 * strength follows the slider. Both operate on source pixels because the
 * element is laid out at native size and scaled by transform afterwards.
 */
export function ViewerFilterDefs({ adjust }: { adjust: Adjustments }) {
  const gain = Math.pow(2, adjust.exposure);
  const k = (adjust.sharpness / 100) * 1.4;
  const kernel = `0 ${-k} 0 ${-k} ${1 + 4 * k} ${-k} 0 ${-k} 0`;
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
      <filter id={SVG_FILTER_ID} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feComponentTransfer result="exposed">
          <feFuncR type="linear" slope={gain} />
          <feFuncG type="linear" slope={gain} />
          <feFuncB type="linear" slope={gain} />
        </feComponentTransfer>
        {adjust.sharpness > 0 && <feConvolveMatrix in="exposed" order="3" kernelMatrix={kernel} preserveAlpha="true" edgeMode="duplicate" />}
      </filter>
    </svg>
  );
}
