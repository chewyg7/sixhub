"use client";

/**
 * Viewer keyboard shortcuts. One table drives both the key handler and the
 * shortcuts dialog, so documentation can't drift from behaviour.
 */
import { useViewer } from "./store";
import { player } from "./controller";
import type { useViewerActions } from "./use-actions";

type Actions = ReturnType<typeof useViewerActions>;

export interface Shortcut {
  keys: string[];
  label: string;
  group: "Playback" | "View" | "Tools" | "Panels";
  /** Matches a KeyboardEvent. */
  match: (e: KeyboardEvent) => boolean;
  run: (ctx: { actions: Actions; openFile: () => void }) => void;
}

const k =
  (key: string, opts: { shift?: boolean; mod?: boolean } = {}) =>
  (e: KeyboardEvent) =>
    e.key.toLowerCase() === key.toLowerCase() && Boolean(opts.shift) === e.shiftKey && Boolean(opts.mod) === (e.ctrlKey || e.metaKey) && !e.altKey;

const S = () => useViewer.getState();

export const SHORTCUTS: Shortcut[] = [
  { group: "Playback", keys: ["Space"], label: "Play / pause", match: (e) => e.key === " " && !e.ctrlKey && !e.metaKey, run: () => player.toggle() },
  { group: "Playback", keys: ["←"], label: "Previous frame", match: k("arrowleft"), run: () => player.stepFrame(-1) },
  { group: "Playback", keys: ["→"], label: "Next frame", match: k("arrowright"), run: () => player.stepFrame(1) },
  { group: "Playback", keys: ["⇧", "←"], label: "Back 1 second", match: k("arrowleft", { shift: true }), run: () => player.stepSeconds(-1) },
  { group: "Playback", keys: ["⇧", "→"], label: "Forward 1 second", match: k("arrowright", { shift: true }), run: () => player.stepSeconds(1) },
  { group: "Playback", keys: ["J"], label: "Play backwards (repeat to speed up)", match: k("j"), run: () => player.shuttle(-1) },
  { group: "Playback", keys: ["K"], label: "Pause", match: k("k"), run: () => player.pause() },
  { group: "Playback", keys: ["L"], label: "Play forwards (repeat to speed up)", match: k("l"), run: () => player.shuttle(1) },
  { group: "Playback", keys: ["Home"], label: "Go to start", match: k("home"), run: () => player.toStart() },
  { group: "Playback", keys: ["End"], label: "Go to end", match: k("end"), run: () => player.toEnd() },
  { group: "Playback", keys: ["M"], label: "Mute", match: k("m"), run: () => player.toggleMute() },

  { group: "View", keys: ["0"], label: "Fit to screen", match: (e) => e.key === "0" && !e.ctrlKey && !e.metaKey, run: () => S().fit("fit") },
  { group: "View", keys: ["1"], label: "100% (actual pixels)", match: (e) => e.key === "1" && !e.ctrlKey && !e.metaKey, run: () => S().zoomTo(1) },
  { group: "View", keys: ["2"], label: "200%", match: (e) => e.key === "2" && !e.ctrlKey && !e.metaKey, run: () => S().zoomTo(2) },
  { group: "View", keys: ["4"], label: "400%", match: (e) => e.key === "4" && !e.ctrlKey && !e.metaKey, run: () => S().zoomTo(4) },
  { group: "View", keys: ["+"], label: "Zoom in", match: (e) => (e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey, run: () => S().zoomBy(1.25) },
  { group: "View", keys: ["−"], label: "Zoom out", match: (e) => (e.key === "-" || e.key === "_") && !e.ctrlKey && !e.metaKey, run: () => S().zoomBy(0.8) },
  { group: "View", keys: ["R"], label: "Rotate right", match: k("r"), run: () => S().rotate(1) },
  { group: "View", keys: ["⇧", "R"], label: "Rotate left", match: k("r", { shift: true }), run: () => S().rotate(-1) },
  { group: "View", keys: ["H"], label: "Flip horizontal", match: k("h"), run: () => S().flip("h") },
  { group: "View", keys: ["⇧", "H"], label: "Flip vertical", match: k("h", { shift: true }), run: () => S().flip("v") },
  { group: "View", keys: ["P"], label: "Toggle pixel inspection", match: k("p"), run: () => S().set({ pixelated: !S().pixelated }) },
  { group: "View", keys: ["N"], label: "Toggle navigator", match: k("n"), run: () => S().set({ minimap: !S().minimap }) },
  { group: "View", keys: ["F"], label: "Fullscreen", match: k("f"), run: () => player.toggleFullscreen() },

  { group: "Tools", keys: ["C"], label: "Crop tool", match: k("c"), run: () => S().setTool(S().tool === "crop" ? "pan" : "crop") },
  { group: "Tools", keys: ["V"], label: "Move / pan tool", match: k("v"), run: () => S().setTool("pan") },
  { group: "Tools", keys: ["↵"], label: "Zoom to crop selection", match: k("enter"), run: () => S().crop.rect && S().zoomToRect(S().crop.rect!) },
  { group: "Tools", keys: ["S"], label: "Save current frame (PNG)", match: k("s"), run: ({ actions }) => actions.captureFrame("download") },
  { group: "Tools", keys: ["⇧", "S"], label: "Copy current frame", match: k("s", { shift: true }), run: ({ actions }) => actions.captureFrame("copy") },
  { group: "Tools", keys: ["X"], label: "Toggle compare", match: k("x"), run: () => S().setCompare({ enabled: !S().compare.enabled }) },
  { group: "Tools", keys: ["Ctrl", "O"], label: "Open a file", match: k("o", { mod: true }), run: ({ openFile }) => openFile() },
  { group: "Tools", keys: ["Ctrl", "V"], label: "Paste an image", match: () => false, run: () => {} },

  { group: "Panels", keys: ["B"], label: "Toggle media browser", match: k("b"), run: () => S().setPanels({ browser: !S().panels.browser }) },
  { group: "Panels", keys: ["I"], label: "Toggle inspector", match: k("i"), run: () => S().setPanels({ inspector: !S().panels.inspector }) },
  { group: "Panels", keys: ["Z"], label: "Distraction-free mode", match: k("z"), run: () => S().setPanels({ focus: !S().panels.focus }) },
  { group: "Panels", keys: ["?"], label: "Keyboard shortcuts", match: (e) => e.key === "?", run: () => S().set({ shortcutsOpen: true }) },
  { group: "Panels", keys: ["Esc"], label: "Exit tool, selection or distraction-free mode", match: () => false, run: () => {} },
];
