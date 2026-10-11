"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, Music2, X } from "lucide-react";
import type { RepoItem } from "@/lib/repos";
import { lockScroll, useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { hostOf } from "./repo-bits";

/**
 * Full-screen view of one repo item. Everything is loaded straight from the
 * repo's own links. Back gesture, Escape, swipe down and the X all close it.
 */
export function RepoViewer({ items, index, onIndex, onClose: closeNow }: { items: RepoItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const item = items[index];
  const count = items.length;
  useFocusTrap(root, true);
  useEffect(() => lockScroll(), []);

  const go = useCallback((d: number) => onIndex((index + d + count) % count), [index, count, onIndex]);

  // Opening adds one history step so the phone's back gesture closes it.
  const closeRef = useRef(closeNow);
  useEffect(() => {
    closeRef.current = closeNow;
  }, [closeNow]);
  useEffect(() => {
    window.history.pushState({ ...window.history.state, ghRepoView: true }, "");
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const onClose = useCallback(() => {
    if (window.history.state?.ghRepoView) window.history.back();
    else closeNow();
  }, [closeNow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !(e.target as HTMLElement)?.closest?.("video,audio")) go(1);
      else if (e.key === "ArrowLeft" && !(e.target as HTMLElement)?.closest?.("video,audio")) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const touch = useRef<{ x: number; y: number } | null>(null);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      data-lenis-prevent
      className="fixed inset-0 z-[90] flex animate-fade-in flex-col bg-[rgb(8_6_11/0.97)] text-white"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (dy > 110 && Math.abs(dx) < 80) onClose();
        else if (Math.abs(dx) > 60 && Math.abs(dy) < 60) go(dx < 0 ? 1 : -1);
      }}
    >
      <header className="flex h-[calc(env(safe-area-inset-top)+60px)] shrink-0 items-center gap-3 px-3 pt-[env(safe-area-inset-top)] sm:px-5">
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15">
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{item.title}</p>
          <p className="truncate text-[12.5px] text-white/50">
            {index + 1} of {count}
            {item.folder ? ` · ${item.folder}` : ""} · from {hostOf(item.url)}
          </p>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/8 px-4 text-[13.5px] font-bold transition-colors hover:bg-white/15"
        >
          <ExternalLink className="size-4" /> <span className="hidden sm:inline">Open original</span>
        </a>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-16">
        {item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party image, loaded straight from the repo's link
          <img key={item.url} src={item.url} alt={item.title} referrerPolicy="no-referrer" className="max-h-full max-w-full animate-fade-in object-contain" />
        ) : item.kind === "video" ? (
          <video key={item.url} src={item.url} poster={item.thumbnail} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg bg-black" />
        ) : (
          <div key={item.url} className="flex w-full max-w-md flex-col items-center gap-6">
            {item.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- third-party cover art
              <img src={item.thumbnail} alt="" referrerPolicy="no-referrer" className="aspect-square w-60 rounded-3xl object-cover shadow-2xl" />
            ) : (
              <span className="flex size-48 items-center justify-center rounded-3xl bg-[image:var(--sunset)]">
                <Music2 className="size-16" />
              </span>
            )}
            <audio src={item.url} controls autoPlay className="w-full" />
          </div>
        )}
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute top-1/2 left-3 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15 sm:flex">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute top-1/2 right-3 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15 sm:flex">
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {(item.description || item.credit) && (
        <footer className="shrink-0 px-5 pt-1 pb-[calc(env(safe-area-inset-bottom)+16px)] text-center text-[13.5px] text-white/60">
          {item.description && <p className="mx-auto line-clamp-3 max-w-2xl whitespace-pre-line">{item.description}</p>}
          {item.credit && <p className="mt-1 text-white/40">Credit: {item.credit}</p>}
        </footer>
      )}
    </div>,
    document.body,
  );
}
