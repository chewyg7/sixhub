"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Adjustments,
  AspectKey,
  Capture,
  CompareState,
  CropState,
  CursorInfo,
  MediaMeta,
  Pane,
  PlaybackState,
  Rect,
  Rotation,
  Transform,
  ViewerMedia,
  ViewState,
} from "./types";
import { DEFAULT_ADJUST } from "./types";
import { clampCentre, clampScale, fitScale, resolveView, rotatedSize, type Size } from "./lib/geometry";
import type { ExportFormat } from "./lib/capture";

export const STAGE_PADDING = 24;
const FIT_VIEW: ViewState = { scale: 1, cx: 0.5, cy: 0.5, mode: "fit" };
const DEFAULT_PLAYBACK: PlaybackState = { playing: false, time: 0, duration: 0, rate: 1, volume: 1, muted: false, loop: false, frame: 0, buffered: [], waiting: false };

export type InspectorSection = "view" | "transform" | "adjust" | "playback" | "crop" | "capture" | "compare" | "info";

interface Panels {
  browser: boolean;
  inspector: boolean;
  focus: boolean;
  browserW: number;
  inspectorW: number;
}

export interface ViewerState {
  a: ViewerMedia | null;
  b: ViewerMedia | null;
  views: Record<Pane, ViewState>;
  stage: Record<Pane, Size>;
  transform: Transform;
  adjust: Adjustments;
  pixelated: boolean;
  minimap: boolean;
  background: "dark" | "checker" | "light";
  tool: "pan" | "crop";
  crop: CropState;
  compare: CompareState;
  panels: Panels;
  collapsed: Partial<Record<InspectorSection, boolean>>;
  playback: PlaybackState;
  captures: Capture[];
  captureOptions: { applyAdjust: boolean; format: ExportFormat };
  cursor: CursorInfo | null;
  shortcutsOpen: boolean;
  /** Error shown over the stage for pane A/B. */
  errors: Partial<Record<Pane, string>>;

  load: (pane: Pane, media: ViewerMedia | null) => void;
  updateMeta: (pane: Pane, patch: Partial<MediaMeta>) => void;
  setMedia: (pane: Pane, patch: Partial<ViewerMedia>) => void;
  setError: (pane: Pane, message: string | null) => void;
  setStage: (pane: Pane, size: Size) => void;
  setView: (pane: Pane, view: ViewState) => void;
  zoomTo: (scale: number, pane?: Pane) => void;
  zoomBy: (factor: number, pane?: Pane) => void;
  fit: (mode?: "fit" | "fill", pane?: Pane) => void;
  zoomToRect: (r: Rect) => void;
  rotate: (dir: 1 | -1) => void;
  flip: (axis: "h" | "v") => void;
  resetTransform: () => void;
  setAdjust: (patch: Partial<Adjustments>) => void;
  resetAdjust: () => void;
  setTool: (tool: "pan" | "crop") => void;
  setCrop: (patch: Partial<CropState>) => void;
  setAspect: (aspect: AspectKey) => void;
  setCompare: (patch: Partial<CompareState>) => void;
  swap: () => void;
  setPanels: (patch: Partial<Panels>) => void;
  toggleSection: (s: InspectorSection, open?: boolean) => void;
  setPlayback: (patch: Partial<PlaybackState>) => void;
  addCapture: (c: Capture) => void;
  removeCapture: (id: string) => void;
  setCaptureOptions: (patch: Partial<ViewerState["captureOptions"]>) => void;
  setCursor: (c: CursorInfo | null) => void;
  set: (patch: Partial<Pick<ViewerState, "pixelated" | "minimap" | "background" | "shortcutsOpen">>) => void;
}

export function mediaSize(m: ViewerMedia | null): Size | null {
  return m?.meta.width && m.meta.height ? { w: m.meta.width, h: m.meta.height } : null;
}

/** Aspect ratio for a crop preset, in displayed orientation. */
export function aspectValue(crop: CropState): number | null {
  switch (crop.aspect) {
    case "16:9":
      return 16 / 9;
    case "4:3":
      return 4 / 3;
    case "1:1":
      return 1;
    case "9:16":
      return 9 / 16;
    case "custom":
      return crop.custom[0] > 0 && crop.custom[1] > 0 ? crop.custom[0] / crop.custom[1] : null;
    default:
      return null;
  }
}

function releaseMedia(m: ViewerMedia | null, keep: (ViewerMedia | null)[]) {
  if (!m || m.origin !== "local") return;
  if (keep.some((k) => k?.src === m.src)) return;
  URL.revokeObjectURL(m.src);
}

export const useViewer = create<ViewerState>()(
  persist(
    (set, get) => {
      /** Concrete view for a pane (fit/fill resolved against its stage). */
      const concrete = (pane: Pane): ViewState | null => {
        const s = get();
        const size = mediaSize(s[pane]);
        if (!size) return null;
        return resolveView(s.views[pane], s.stage[pane], size, s.transform.rotation, STAGE_PADDING);
      };

      /** Mirror a view onto the other pane when side-by-side zoom is synced. */
      const withSync = (pane: Pane, view: ViewState, views: Record<Pane, ViewState>): Record<Pane, ViewState> => {
        const s = get();
        const next = { ...views, [pane]: view };
        if (!(s.compare.enabled && s.compare.mode === "side" && s.compare.sync)) return next;
        const other: Pane = pane === "a" ? "b" : "a";
        const from = mediaSize(s[pane]);
        const to = mediaSize(s[other]);
        if (!from || !to) return next;
        next[other] = view.mode === "custom" ? { ...view, scale: clampScale(view.scale * (from.w / to.w)) } : { ...view };
        return next;
      };

      return {
        a: null,
        b: null,
        views: { a: FIT_VIEW, b: FIT_VIEW },
        stage: { a: { w: 800, h: 600 }, b: { w: 800, h: 600 } },
        transform: { rotation: 0, flipH: false, flipV: false },
        adjust: DEFAULT_ADJUST,
        pixelated: true,
        minimap: true,
        background: "dark",
        tool: "pan",
        crop: { aspect: "free", custom: [21, 9], rect: null },
        compare: { enabled: false, mode: "slider", sync: true, opacity: 0.5, split: 0.5, blend: "normal", linkPlayback: true, offset: 0 },
        panels: { browser: true, inspector: true, focus: false, browserW: 280, inspectorW: 320 },
        collapsed: { capture: false },
        playback: DEFAULT_PLAYBACK,
        captures: [],
        captureOptions: { applyAdjust: false, format: "image/png" },
        cursor: null,
        shortcutsOpen: false,
        errors: {},

        load: (pane, media) =>
          set((s) => {
            releaseMedia(s[pane], [pane === "a" ? s.b : s.a, media]);
            const patch: Partial<ViewerState> = {
              [pane]: media,
              views: { ...s.views, [pane]: FIT_VIEW },
              errors: { ...s.errors, [pane]: undefined },
            };
            if (pane === "a") {
              patch.playback = { ...DEFAULT_PLAYBACK, rate: s.playback.rate, volume: s.playback.volume, muted: s.playback.muted, loop: s.playback.loop };
              patch.crop = { ...s.crop, rect: null };
              patch.cursor = null;
              if (media?.kind === "audio") patch.tool = "pan";
            }
            if (pane === "b" && media) patch.compare = { ...s.compare, enabled: true };
            return patch;
          }),

        updateMeta: (pane, patch) =>
          set((s) => {
            const m = s[pane];
            if (!m) return {};
            // Don't let measured values override exact metadata.
            if (patch.fpsSource === "measured" && m.meta.fpsSource && m.meta.fpsSource !== "assumed") {
              const { fps: _f, fpsSource: _s, ...rest } = patch;
              void _f;
              void _s;
              patch = rest;
            }
            return { [pane]: { ...m, meta: { ...m.meta, ...patch } } };
          }),

        setMedia: (pane, patch) => set((s) => (s[pane] ? { [pane]: { ...s[pane]!, ...patch } } : {})),
        setError: (pane, message) => set((s) => ({ errors: { ...s.errors, [pane]: message ?? undefined } })),

        setStage: (pane, size) => set((s) => (s.stage[pane].w === size.w && s.stage[pane].h === size.h ? {} : { stage: { ...s.stage, [pane]: size } })),

        setView: (pane, view) => set((s) => ({ views: withSync(pane, clampCentre(view), s.views) })),

        zoomTo: (scale, pane = "a") => {
          const cur = concrete(pane);
          if (!cur) return;
          get().setView(pane, { ...cur, scale: clampScale(scale), mode: "custom", animate: true });
        },
        zoomBy: (factor, pane = "a") => {
          const cur = concrete(pane);
          if (!cur) return;
          get().setView(pane, { ...cur, scale: clampScale(cur.scale * factor), mode: "custom", animate: true });
        },
        fit: (mode = "fit", pane = "a") => get().setView(pane, { scale: 1, cx: 0.5, cy: 0.5, mode, animate: true }),
        zoomToRect: (r) => {
          const s = get();
          const size = mediaSize(s.a);
          if (!size) return;
          const rs = rotatedSize(r.w, r.h, s.transform.rotation);
          const st = s.stage.a;
          const scale = clampScale(Math.min((st.w - STAGE_PADDING * 4) / rs.w, (st.h - STAGE_PADDING * 4) / rs.h));
          get().setView("a", { scale, cx: (r.x + r.w / 2) / size.w, cy: (r.y + r.h / 2) / size.h, mode: "custom", animate: true });
        },

        rotate: (dir) =>
          set((s) => ({
            transform: { ...s.transform, rotation: ((((s.transform.rotation + dir * 90) % 360) + 360) % 360) as Rotation },
            views: { a: { ...s.views.a, animate: true }, b: { ...s.views.b, animate: true } },
          })),
        flip: (axis) => set((s) => ({ transform: { ...s.transform, [axis === "h" ? "flipH" : "flipV"]: !s.transform[axis === "h" ? "flipH" : "flipV"] } })),
        resetTransform: () => set({ transform: { rotation: 0, flipH: false, flipV: false } }),

        setAdjust: (patch) => set((s) => ({ adjust: { ...s.adjust, ...patch } })),
        resetAdjust: () => set({ adjust: DEFAULT_ADJUST }),

        setTool: (tool) => set({ tool }),
        setCrop: (patch) => set((s) => ({ crop: { ...s.crop, ...patch } })),
        setAspect: (aspect) =>
          set((s) => {
            const crop = { ...s.crop, aspect };
            const ratio = aspectValue(crop);
            const size = mediaSize(s.a);
            // Re-fit the existing selection to the new ratio around its centre.
            if (crop.rect && ratio && size) {
              const r = crop.rect;
              const srcRatio = s.transform.rotation % 180 ? 1 / ratio : ratio;
              let w = r.w;
              let h = w / srcRatio;
              if (h > r.h) {
                h = r.h;
                w = h * srcRatio;
              }
              const cx = r.x + r.w / 2;
              const cy = r.y + r.h / 2;
              crop.rect = { x: Math.max(0, cx - w / 2), y: Math.max(0, cy - h / 2), w, h };
            }
            return { crop };
          }),

        setCompare: (patch) => set((s) => ({ compare: { ...s.compare, ...patch } })),
        swap: () =>
          set((s) => ({
            a: s.b,
            b: s.a,
            views: { a: s.views.b, b: s.views.a },
            crop: { ...s.crop, rect: null },
            playback: { ...DEFAULT_PLAYBACK, rate: s.playback.rate, volume: s.playback.volume, muted: s.playback.muted, loop: s.playback.loop },
          })),

        setPanels: (patch) => set((s) => ({ panels: { ...s.panels, ...patch } })),
        toggleSection: (sec, open) => set((s) => ({ collapsed: { ...s.collapsed, [sec]: open === undefined ? !s.collapsed[sec] : !open } })),
        setPlayback: (patch) => set((s) => ({ playback: { ...s.playback, ...patch } })),
        addCapture: (c) => set((s) => ({ captures: [c, ...s.captures].slice(0, 24) })),
        removeCapture: (id) =>
          set((s) => {
            const c = s.captures.find((x) => x.id === id);
            // Keep the object URL alive if the capture is on screen.
            if (c && s.a?.src !== c.url && s.b?.src !== c.url) URL.revokeObjectURL(c.url);
            return { captures: s.captures.filter((x) => x.id !== id) };
          }),
        setCaptureOptions: (patch) => set((s) => ({ captureOptions: { ...s.captureOptions, ...patch } })),
        setCursor: (cursor) => set({ cursor }),
        set: (patch) => set(patch),
      };
    },
    {
      name: "gh:viewer",
      version: 1,
      partialize: (s) => ({
        pixelated: s.pixelated,
        minimap: s.minimap,
        background: s.background,
        panels: { ...s.panels, focus: false },
        collapsed: s.collapsed,
        captureOptions: s.captureOptions,
        playback: { ...DEFAULT_PLAYBACK, volume: s.playback.volume, muted: s.playback.muted },
        compare: { ...s.compare, enabled: false },
        crop: { ...s.crop, rect: null },
      }),
    },
  ),
);

/** Resolved (concrete) view for rendering and tools. */
export function useConcreteView(pane: Pane): ViewState | null {
  const media = useViewer((s) => s[pane]);
  const view = useViewer((s) => s.views[pane]);
  const stage = useViewer((s) => s.stage[pane]);
  const rotation = useViewer((s) => s.transform.rotation);
  const size = mediaSize(media);
  if (!size) return null;
  return resolveView(view, stage, size, rotation, STAGE_PADDING);
}

export function fitScaleFor(pane: Pane): number | null {
  const s = useViewer.getState();
  const size = mediaSize(s[pane]);
  return size ? fitScale(s.stage[pane], size, s.transform.rotation, "fit", STAGE_PADDING) : null;
}
