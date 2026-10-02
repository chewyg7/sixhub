/**
 * Frame capture and crop export.
 *
 * Draws straight from the media element into a canvas sized to the
 * source's native resolution (videoWidth/naturalWidth) — not a screenshot
 * of the on-screen element — so captures are pixel-exact.
 */
import type { Adjustments, Rect, Transform } from "../types";
import { cssFilterParts } from "./filters";

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp";

export class CaptureError extends Error {}

export function nativeSize(el: HTMLVideoElement | HTMLImageElement): { w: number; h: number } {
  return el instanceof HTMLVideoElement ? { w: el.videoWidth, h: el.videoHeight } : { w: el.naturalWidth, h: el.naturalHeight };
}

interface Options {
  region?: Rect | null;
  adjust?: Adjustments;
  transform?: Transform;
  format?: ExportFormat;
  quality?: number;
}

export async function captureElement(el: HTMLVideoElement | HTMLImageElement, opts: Options = {}): Promise<{ blob: Blob; width: number; height: number }> {
  const { w, h } = nativeSize(el);
  if (!w || !h) throw new CaptureError("The media hasn't loaded yet.");
  const r = opts.region ? { x: Math.round(opts.region.x), y: Math.round(opts.region.y), w: Math.round(opts.region.w), h: Math.round(opts.region.h) } : { x: 0, y: 0, w, h };
  if (r.w < 1 || r.h < 1) throw new CaptureError("The selection is empty.");
  const t = opts.transform ?? { rotation: 0, flipH: false, flipV: false };
  const swap = t.rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? r.h : r.w;
  canvas.height = swap ? r.w : r.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CaptureError("Canvas is unavailable.");
  ctx.imageSmoothingEnabled = false;
  const filter = opts.adjust ? cssFilterParts(opts.adjust) : "";
  if (filter && "filter" in ctx) ctx.filter = filter;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
  ctx.drawImage(el, r.x, r.y, r.w, r.h, -r.w / 2, -r.h / 2, r.w, r.h);

  const format = opts.format ?? "image/png";
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, opts.quality ?? 0.95));
    if (!blob) throw new CaptureError("The browser couldn't encode the image.");
    return { blob, width: canvas.width, height: canvas.height };
  } catch (e) {
    if (e instanceof DOMException && e.name === "SecurityError")
      throw new CaptureError("This source doesn't allow its pixels to be read (cross-origin). Download it and open the file locally instead.");
    throw e;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyBlob(blob: Blob) {
  if (!("ClipboardItem" in window) || !navigator.clipboard?.write) throw new CaptureError("Copying images isn't supported in this browser.");
  // Clipboard only reliably accepts PNG.
  let png = blob;
  if (blob.type !== "image/png") {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    png = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new CaptureError("Encoding failed"))), "image/png"));
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/** Read one pixel's colour at source coordinates. Returns null when pixels are unreadable. */
let probeCtx: CanvasRenderingContext2D | null = null;
export function samplePixel(el: HTMLVideoElement | HTMLImageElement, x: number, y: number): string | null {
  try {
    if (!probeCtx) {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      probeCtx = c.getContext("2d", { willReadFrequently: true });
    }
    if (!probeCtx) return null;
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.drawImage(el, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
    const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return "transparent";
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function safeFilename(s: string) {
  return s
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
}
