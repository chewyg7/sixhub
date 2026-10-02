"use client";

import { useMemo } from "react";
import type { MediaItem } from "@/types/content";
import { useToast } from "@/components/ui/toast";
import { library } from "@/features/library/store";
import type { Capture, Pane, ViewerMedia } from "./types";
import { useViewer } from "./store";
import { getElement } from "./controller";
import { captureElement, CaptureError, copyBlob, downloadBlob, safeFilename } from "./lib/capture";
import { fromArchive, fromCapture, fromFile, fromUrl, probeContainer } from "./lib/sources";
import { buildShareUrl } from "./lib/url-state";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Load media into a pane and enrich its metadata in the background. */
export function loadMedia(pane: Pane, media: ViewerMedia) {
  const s = useViewer.getState();
  s.load(pane, media);
  if (media.slug) library.recordView(media.slug);
  if (media.origin === "local" || media.origin === "url") {
    probeContainer(media).then((patch) => {
      // Only apply if the same media is still loaded.
      if (Object.keys(patch).length && useViewer.getState()[pane]?.id === media.id) useViewer.getState().updateMeta(pane, patch);
    });
  }
}

export function useViewerActions() {
  const toast = useToast();

  return useMemo(() => {
    const fail = (e: unknown) => toast(e instanceof CaptureError ? e.message : "Something went wrong.", { tone: "error", duration: 4200 });

    const openArchive = (item: MediaItem, pane: Pane = "a") => loadMedia(pane, fromArchive(item));

    const openFiles = (files: FileList | File[], pane: Pane = "a") => {
      const list = Array.from(files);
      const first = list.map(fromFile).find(Boolean);
      if (!first) {
        toast("That file type isn't supported. Open an image, video or audio file.", { tone: "error" });
        return;
      }
      loadMedia(pane, first);
      // Dropping two files opens them side by side for comparison.
      const second = list.slice(1).map(fromFile).find(Boolean);
      if (pane === "a" && second) loadMedia("b", second);
    };

    const openUrl = (url: string, pane: Pane = "a") => {
      const m = fromUrl(url);
      if ("error" in m) {
        toast(m.error, { tone: "error" });
        return false;
      }
      loadMedia(pane, m);
      return true;
    };

    const openCapture = (c: Capture, pane: Pane = "a") => loadMedia(pane, fromCapture(c));

    const baseName = () => {
      const s = useViewer.getState();
      return safeFilename(s.a?.slug ?? s.a?.title ?? "gta6hub");
    };

    /** Capture the current frame (video) or full image at native resolution. */
    const captureFrame = async (mode: "download" | "copy" | "open" | "compare" | "keep" = "keep") => {
      const s = useViewer.getState();
      const el = getElement("a");
      if (!s.a || !el || el instanceof HTMLAudioElement) return;
      try {
        const { applyAdjust, format } = s.captureOptions;
        const { blob, width, height } = await captureElement(el, {
          adjust: applyAdjust ? s.adjust : undefined,
          transform: applyAdjust ? s.transform : undefined,
          format: mode === "copy" ? "image/png" : format,
        });
        const isVideo = s.a.kind === "video";
        const fps = s.a.meta.fps ?? 30;
        const frame = s.playback.frame;
        const tc = isVideo ? `_${(frame / fps).toFixed(3).replace(".", "s")}_f${frame}` : "";
        const title = `${baseName()}${tc}`;
        const capture: Capture = {
          id: Math.random().toString(36).slice(2),
          url: URL.createObjectURL(blob),
          blob,
          width,
          height,
          title,
          time: isVideo ? frame / fps : undefined,
          frame: isVideo ? frame : undefined,
          createdAt: Date.now(),
        };
        s.addCapture(capture);
        if (mode === "download") {
          downloadBlob(blob, `${title}.${EXT[blob.type] ?? "png"}`);
          toast(`Saved ${width}×${height} frame`);
        } else if (mode === "copy") {
          await copyBlob(blob);
          toast(`Copied ${width}×${height} frame`);
        } else if (mode === "open") {
          openCapture(capture, "a");
        } else if (mode === "compare") {
          openCapture(capture, "b");
          useViewer.getState().setCompare({ enabled: true, mode: "slider", linkPlayback: false });
          toast("Frame pinned as B — scrub A to compare");
        } else toast(`Captured frame ${isVideo ? frame : ""}`.trim());
      } catch (e) {
        fail(e);
      }
    };

    const exportCrop = async (mode: "download" | "copy" | "open") => {
      const s = useViewer.getState();
      const el = getElement("a");
      const r = s.crop.rect;
      if (!s.a || !el || el instanceof HTMLAudioElement || !r) return;
      try {
        const { applyAdjust, format } = s.captureOptions;
        const { blob, width, height } = await captureElement(el, {
          region: r,
          adjust: applyAdjust ? s.adjust : undefined,
          transform: applyAdjust ? s.transform : undefined,
          format: mode === "copy" ? "image/png" : format,
        });
        const title = `${baseName()}_crop_${Math.round(r.x)}-${Math.round(r.y)}_${width}x${height}`;
        if (mode === "download") {
          downloadBlob(blob, `${title}.${EXT[blob.type] ?? "png"}`);
          toast(`Saved ${width}×${height} crop`);
        } else if (mode === "copy") {
          await copyBlob(blob);
          toast(`Copied ${width}×${height} crop`);
        } else {
          const c: Capture = { id: Math.random().toString(36).slice(2), url: URL.createObjectURL(blob), blob, width, height, title, createdAt: Date.now() };
          s.addCapture(c);
          openCapture(c, "a");
          useViewer.getState().setTool("pan");
        }
      } catch (e) {
        fail(e);
      }
    };

    const copyLink = async () => {
      const s = useViewer.getState();
      const url = buildShareUrl(s);
      try {
        await navigator.clipboard.writeText(url);
        const local = s.a && (s.a.origin === "local" || s.a.origin === "capture");
        toast(local ? "Link copied — local files and captures aren't included in shared links" : "Link to this view copied", {
          tone: local ? "info" : "success",
          duration: local ? 4200 : 2600,
        });
      } catch {
        toast("Couldn't copy the link", { tone: "error" });
      }
    };

    return { openArchive, openFiles, openUrl, openCapture, captureFrame, exportCrop, copyLink };
  }, [toast]);
}
