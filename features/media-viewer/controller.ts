"use client";

/**
 * Imperative media control. The store holds serializable state; the
 * actual <video>/<audio>/<img> elements are registered here so actions
 * (from buttons, shortcuts or the URL) all drive the same elements.
 */
import type { Pane } from "./types";
import { useViewer } from "./store";

type El = HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
const elements: Record<Pane, El | null> = { a: null, b: null };
let viewerRoot: HTMLElement | null = null;

export function registerElement(pane: Pane, el: El | null) {
  elements[pane] = el;
}
export function getElement(pane: Pane) {
  return elements[pane];
}
export function registerRoot(el: HTMLElement | null) {
  viewerRoot = el;
}

function timed(pane: Pane = "a"): HTMLMediaElement | null {
  const el = elements[pane];
  return el instanceof HTMLMediaElement ? el : null;
}

export function fpsOf(pane: Pane = "a") {
  return useViewer.getState()[pane]?.meta.fps ?? 30;
}

/** Frame index of a media time. Small epsilon avoids float drift at frame boundaries. */
export function frameAt(time: number, fps: number) {
  return Math.floor(time * fps + 1e-3);
}

/* ------------------------------------------------------------------ */
/* Linked playback for compare pane B                                  */
/* ------------------------------------------------------------------ */
function linkedB(): HTMLMediaElement | null {
  const s = useViewer.getState();
  if (!s.compare.enabled || !s.compare.linkPlayback) return null;
  return timed("b");
}

export function syncB(force = false) {
  const a = timed("a");
  const b = linkedB();
  if (!a || !b) return;
  const target = Math.min(Math.max(0, a.currentTime + useViewer.getState().compare.offset), b.duration || Infinity);
  if (force || Math.abs(b.currentTime - target) > 0.12) b.currentTime = target;
  if (b.playbackRate !== a.playbackRate) b.playbackRate = a.playbackRate;
  if (a.paused && !b.paused) b.pause();
  if (!a.paused && b.paused) b.play().catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Shuttle (J/K/L)                                                     */
/* ------------------------------------------------------------------ */
let shuttleSpeed = 0; // negative = reverse
let shuttleRaf = 0;

function stopReverse() {
  cancelAnimationFrame(shuttleRaf);
  shuttleRaf = 0;
}

function runReverse() {
  const v = timed();
  if (!v) return;
  let last = performance.now();
  let seeking = false;
  const onSeeked = () => (seeking = false);
  v.addEventListener("seeked", onSeeked);
  const tick = (now: number) => {
    if (shuttleSpeed >= 0) {
      v.removeEventListener("seeked", onSeeked);
      return;
    }
    const dt = (now - last) / 1000;
    if (!seeking) {
      last = now;
      const next = Math.max(0, v.currentTime + shuttleSpeed * dt);
      seeking = true;
      v.currentTime = next;
      if (next <= 0) {
        shuttleSpeed = 0;
        v.removeEventListener("seeked", onSeeked);
        return;
      }
    }
    shuttleRaf = requestAnimationFrame(tick);
  };
  shuttleRaf = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
export const player = {
  get element() {
    return timed();
  },
  isTimed() {
    return Boolean(timed());
  },
  play() {
    const v = timed();
    if (!v) return;
    shuttleSpeed = 0;
    stopReverse();
    if (v.ended) v.currentTime = 0;
    v.play().catch(() => {});
  },
  pause() {
    const v = timed();
    shuttleSpeed = 0;
    stopReverse();
    v?.pause();
  },
  toggle() {
    const v = timed();
    if (!v) return;
    if (v.paused || shuttleSpeed < 0) player.play();
    else player.pause();
  },
  seek(t: number) {
    const v = timed();
    if (!v) return;
    const d = v.duration || useViewer.getState().playback.duration || t;
    v.currentTime = Math.min(Math.max(0, t), d);
    useViewer.getState().setPlayback({ time: v.currentTime, frame: frameAt(v.currentTime, fpsOf()) });
    syncB(true);
  },
  /** Step whole frames. Seeks to the middle of the target frame so decoders land on it exactly. */
  stepFrame(n: number) {
    const v = timed();
    if (!v || !(v instanceof HTMLVideoElement)) {
      if (v) player.seek(v.currentTime + n * 0.1);
      return;
    }
    player.pause();
    const fps = fpsOf();
    const current = useViewer.getState().playback.frame;
    const total = Math.max(0, Math.floor((v.duration || 0) * fps) - 1);
    const target = Math.min(total, Math.max(0, current + n));
    v.currentTime = (target + 0.5) / fps;
    useViewer.getState().setPlayback({ frame: target, time: v.currentTime });
    syncB(true);
  },
  stepSeconds(s: number) {
    const v = timed();
    if (v) player.seek(v.currentTime + s);
  },
  toStart() {
    player.seek(0);
  },
  toEnd() {
    const v = timed();
    if (v) player.seek(Math.max(0, (v.duration || 0) - 1 / fpsOf()));
  },
  setRate(r: number) {
    const rate = Math.min(16, Math.max(0.0625, r));
    const v = timed();
    if (v) v.playbackRate = rate;
    const b = linkedB();
    if (b) b.playbackRate = rate;
    useViewer.getState().setPlayback({ rate });
  },
  setVolume(vol: number) {
    const v = timed();
    if (v) {
      v.volume = vol;
      v.muted = vol === 0;
    }
    useViewer.getState().setPlayback({ volume: vol, muted: vol === 0 });
  },
  toggleMute() {
    const v = timed();
    if (v) v.muted = !v.muted;
    useViewer.getState().setPlayback({ muted: v ? v.muted : !useViewer.getState().playback.muted });
  },
  setLoop(loop: boolean) {
    const v = timed();
    if (v) v.loop = loop;
    useViewer.getState().setPlayback({ loop });
  },
  /** L: forward shuttle, speeds up on repeat (1× → 1.5× → 2× → 4×). J: reverse shuttle. */
  shuttle(dir: 1 | -1) {
    const v = timed();
    if (!v) return;
    const steps = [1, 1.5, 2, 4];
    if (dir > 0) {
      stopReverse();
      const cur = shuttleSpeed > 0 ? shuttleSpeed : 0;
      shuttleSpeed = steps.find((s) => s > cur) ?? 4;
      v.playbackRate = shuttleSpeed;
      useViewer.getState().setPlayback({ rate: shuttleSpeed });
      v.play().catch(() => {});
    } else {
      const cur = shuttleSpeed < 0 ? -shuttleSpeed : 0;
      const next = steps.find((s) => s > cur) ?? 4;
      v.pause();
      const wasRunning = shuttleSpeed < 0;
      shuttleSpeed = -next;
      if (!wasRunning) runReverse();
    }
  },
  shuttleSpeed() {
    return shuttleSpeed;
  },
  async pip() {
    const v = timed();
    if (!(v instanceof HTMLVideoElement)) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await v.requestPictureInPicture();
  },
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else viewerRoot?.requestFullscreen?.().catch(() => {});
  },
};
