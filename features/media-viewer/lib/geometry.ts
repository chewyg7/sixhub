/**
 * View geometry for the Media Viewer.
 *
 * A source pixel p maps to the screen through
 *   M = T(stageCentre) · S(scale) · R(rotation) · F(flip) · T(-centre·size)
 * Everything (zoom around the cursor, panning, crop handles, navigator,
 * pixel read-out) goes through this one matrix and its inverse, so all
 * tools agree under any rotation, flip or zoom.
 */
import type { Rect, Rotation, Transform, ViewState } from "../types";

/** [a, b, c, d, e, f] as in DOMMatrix: x' = a·x + c·y + e, y' = b·x + d·y + f */
export type Mat = [number, number, number, number, number, number];

export interface Size {
  w: number;
  h: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 64;

export function multiply(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export function apply(m: Mat, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Linear part R·F (rotation + flip) — orthogonal, so its inverse is its transpose. */
function orient(t: Transform): Mat {
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  const fx = t.flipH ? -1 : 1;
  const fy = t.flipV ? -1 : 1;
  // R = [cos -sin; sin cos], F = diag(fx, fy)
  return [cos * fx, sin * fx, -sin * fy, cos * fy, 0, 0];
}

export function rotatedSize(w: number, h: number, rotation: Rotation): Size {
  return rotation % 180 === 0 ? { w, h } : { w: h, h: w };
}

export function fitScale(stage: Size, media: Size, rotation: Rotation, mode: "fit" | "fill" = "fit", padding = 0): number {
  const r = rotatedSize(media.w, media.h, rotation);
  const sw = Math.max(1, stage.w - padding * 2);
  const sh = Math.max(1, stage.h - padding * 2);
  return mode === "fill" ? Math.max(sw / r.w, sh / r.h) : Math.min(sw / r.w, sh / r.h);
}

/** Resolve fit/fill modes into concrete numbers for the current stage. */
export function resolveView(view: ViewState, stage: Size, media: Size, rotation: Rotation, padding: number): ViewState {
  if (view.mode === "custom") return view;
  return { ...view, scale: fitScale(stage, media, rotation, view.mode, padding), cx: 0.5, cy: 0.5 };
}

export function viewMatrix(stage: Size, media: Size, view: ViewState, t: Transform): Mat {
  const o = orient(t);
  const s = view.scale;
  const linear: Mat = [o[0] * s, o[1] * s, o[2] * s, o[3] * s, 0, 0];
  const toCentre: Mat = [1, 0, 0, 1, -view.cx * media.w, -view.cy * media.h];
  const m = multiply(linear, toCentre);
  m[4] += stage.w / 2;
  m[5] += stage.h / 2;
  return m;
}

export function cssMatrix(m: Mat): string {
  return `matrix(${m.map((v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6))).join(",")})`;
}

export function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Zoom to `scale`, keeping the source point under `pt` (stage coords) fixed. */
export function zoomAround(view: ViewState, pt: { x: number; y: number }, scale: number, stage: Size, media: Size, t: Transform): ViewState {
  const m = viewMatrix(stage, media, view, t);
  const src = apply(invert(m), pt.x, pt.y);
  const s = clampScale(scale);
  const o = orient(t);
  // (R·F)^-1 = transpose
  const dx = (pt.x - stage.w / 2) / s;
  const dy = (pt.y - stage.h / 2) / s;
  const ux = o[0] * dx + o[1] * dy;
  const uy = o[2] * dx + o[3] * dy;
  return clampCentre({ scale: s, cx: (src.x - ux) / media.w, cy: (src.y - uy) / media.h, mode: "custom" });
}

/** Pan by a screen-space delta. */
export function panBy(view: ViewState, dx: number, dy: number, t: Transform, media: Size): ViewState {
  const o = orient(t);
  const sx = dx / view.scale;
  const sy = dy / view.scale;
  const ux = o[0] * sx + o[1] * sy;
  const uy = o[2] * sx + o[3] * sy;
  return clampCentre({ ...view, cx: view.cx - ux / media.w, cy: view.cy - uy / media.h, mode: "custom", animate: false });
}

/** Keep the view centre on the media so it can't be panned away entirely. */
export function clampCentre(v: ViewState): ViewState {
  return { ...v, cx: Math.min(1, Math.max(0, v.cx)), cy: Math.min(1, Math.max(0, v.cy)) };
}

/** Axis-aligned screen rect of a source rect (rotation is always a multiple of 90°). */
export function sourceRectToScreen(r: Rect, m: Mat) {
  const p1 = apply(m, r.x, r.y);
  const p2 = apply(m, r.x + r.w, r.y + r.h);
  return { left: Math.min(p1.x, p2.x), top: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) };
}

/** The part of the source currently visible on the stage (for the navigator). */
export function visibleSourceRect(stage: Size, m: Mat, media: Size): Rect {
  const inv = invert(m);
  const a = apply(inv, 0, 0);
  const b = apply(inv, stage.w, stage.h);
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const x1 = Math.min(media.w, Math.max(a.x, b.x));
  const y1 = Math.min(media.h, Math.max(a.y, b.y));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** View that frames a source rect with some margin. */
export function viewForRect(r: Rect, stage: Size, t: Transform, margin = 0.9): ViewState {
  const rs = rotatedSize(r.w, r.h, t.rotation);
  const scale = clampScale(Math.min((stage.w * margin) / rs.w, (stage.h * margin) / rs.h));
  return { scale, cx: 0, cy: 0, mode: "custom", animate: true };
}

export function clampRect(r: Rect, media: Size): Rect {
  const w = Math.min(Math.max(1, r.w), media.w);
  const h = Math.min(Math.max(1, r.h), media.h);
  const x = Math.min(Math.max(0, r.x), media.w - w);
  const y = Math.min(Math.max(0, r.y), media.h - h);
  return { x, y, w, h };
}

export function roundRect(r: Rect): Rect {
  const x = Math.round(r.x);
  const y = Math.round(r.y);
  return { x, y, w: Math.round(r.x + r.w) - x, h: Math.round(r.y + r.h) - y };
}
