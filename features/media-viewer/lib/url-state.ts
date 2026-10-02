/**
 * Shareable viewer state in the URL. Only what's needed to reproduce a
 * discovery: media, timestamp, zoom/centre, rotation and comparison.
 *
 *   /viewer?m=<slug>&t=12.345&z=4&x=0.4123&y=0.5521&r=90&b=<slug>&cm=slider
 *   /viewer?src=<https url>        (remote files)
 */
import type { CompareMode, Rotation } from "../types";
import type { ViewerState } from "../store";

export interface UrlState {
  m?: string;
  src?: string;
  t?: number;
  z?: number;
  x?: number;
  y?: number;
  r?: Rotation;
  b?: string;
  bsrc?: string;
  cm?: CompareMode;
  compare?: boolean;
}

export function parseUrlState(sp: URLSearchParams): UrlState {
  const num = (k: string) => {
    const v = sp.get(k);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const r = num("r");
  const cm = sp.get("cm");
  return {
    m: sp.get("m") ?? undefined,
    src: sp.get("src") ?? undefined,
    t: num("t"),
    z: num("z"),
    x: num("x"),
    y: num("y"),
    r: r === 90 || r === 180 || r === 270 ? r : undefined,
    b: sp.get("b") ?? undefined,
    bsrc: sp.get("bsrc") ?? undefined,
    cm: cm === "side" || cm === "overlay" || cm === "slider" ? cm : undefined,
    compare: sp.get("compare") === "1",
  };
}

export function serializeUrlState(s: ViewerState, includeTime: boolean): URLSearchParams {
  const sp = new URLSearchParams();
  if (s.a?.origin === "archive" && s.a.slug) sp.set("m", s.a.slug);
  else if (s.a?.origin === "url") sp.set("src", s.a.src);
  if (includeTime && s.a && s.a.kind !== "image" && s.playback.time > 0.001) {
    const fps = s.a.meta.fps ?? 30;
    // Share the middle of the current frame so the link lands on it exactly.
    sp.set("t", (s.a.kind === "video" ? (s.playback.frame + 0.5) / fps : s.playback.time).toFixed(3));
  }
  const v = s.views.a;
  if (v.mode === "custom" && s.a?.kind !== "audio") {
    sp.set("z", String(+v.scale.toFixed(4)));
    sp.set("x", v.cx.toFixed(4));
    sp.set("y", v.cy.toFixed(4));
  }
  if (s.transform.rotation) sp.set("r", String(s.transform.rotation));
  if (s.compare.enabled && s.b) {
    if (s.b.origin === "archive" && s.b.slug) sp.set("b", s.b.slug);
    else if (s.b.origin === "url") sp.set("bsrc", s.b.src);
    sp.set("cm", s.compare.mode);
  }
  return sp;
}

export function buildShareUrl(s: ViewerState): string {
  const sp = serializeUrlState(s, true);
  return `${window.location.origin}/viewer${sp.size ? `?${sp}` : ""}`;
}
