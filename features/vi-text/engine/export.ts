// PNG export: filename and delivery (download, iOS share sheet or long-press overlay).

function sanitize(part: string, max: number): string {
  return part
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, "");
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

/** e.g. "VICE CITY - OVERLAY 2026-10-04 0137.png" */
export function exportFileName(text: string, layerText = "", now = new Date()): string {
  const base = [sanitize(text, 48), sanitize(layerText, 32)].filter(Boolean).join(" - ") || "text";
  return `${base} ${stamp(now)}.png`;
}

export function isIOS(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1))
  );
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Delivers the PNG. On iOS the share sheet is tried first; if sharing is not
 * possible the object URL is returned so the caller can show the long-press
 * "Add to Photos" overlay. Elsewhere a temporary <a download> is clicked.
 */
export async function deliverPng(blob: Blob, fileName: string): Promise<string | null> {
  const ios = isIOS();
  if (ios && typeof navigator.canShare === "function" && navigator.share) {
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return null;
      } catch (err) {
        if ((err as Error | null)?.name === "AbortError") return null;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  if (ios) return url;
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return null;
}
