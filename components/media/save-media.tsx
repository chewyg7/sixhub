"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, LoaderCircle, Share } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";

/** Above this the file isn't prefetched for the share sheet (long videos); it downloads instead. */
const SHARE_LIMIT = 60 * 1024 * 1024;

/**
 * Computers (a mouse or trackpad, and not an iPad) always download: their
 * share sheets are no use for saving a file. Phones and tablets share.
 */
const isComputer = () => {
  const iPad = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return !iPad && matchMedia("(hover: hover) and (pointer: fine)").matches;
};

const canShareFiles = () => {
  if (typeof navigator === "undefined" || !navigator.canShare || isComputer()) return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

const noop = () => () => {};
/** Whether this device saves through the share sheet. Always false on the server. */
const useCanShare = () => useSyncExternalStore(noop, canShareFiles, () => false);

/**
 * Keeps the item's file ready to hand to the share sheet. iOS only opens the
 * sheet straight from a tap, so the file has to be fetched before the tap,
 * not after it.
 */
function useShareFile(item: MediaItem, canShare: boolean) {
  const [state, setState] = useState<{ slug: string; file: File | null; failed: boolean }>({ slug: item.slug, file: null, failed: false });
  const sharable = item.original.url.startsWith("/") && (item.original.bytes ?? 0) <= SHARE_LIMIT;
  useEffect(() => {
    if (!sharable || !canShare) return;
    let live = true;
    const ctl = new AbortController();
    fetch(item.original.url, { signal: ctl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (!live) return;
        const file = new File([blob], item.original.filename, { type: blob.type || item.original.mimeType });
        setState({ slug: item.slug, file: navigator.canShare({ files: [file] }) ? file : null, failed: false });
      })
      .catch(() => live && setState({ slug: item.slug, file: null, failed: true }));
    return () => {
      live = false;
      ctl.abort();
    };
  }, [item.slug, item.original.url, item.original.filename, item.original.mimeType, sharable, canShare]);
  const current = state.slug === item.slug ? state : { file: null, failed: false };
  return { file: current.file, preparing: sharable && canShare && !current.file && !current.failed };
}

function download(item: MediaItem) {
  const a = document.createElement("a");
  a.href = item.original.url;
  a.download = item.original.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Save button. On phones it opens the share sheet with the file itself, so
 * "Save Image" / "Save Video" (iOS) or "Save to device" (Android) is one tap
 * away. On computers (or for very large files) it's a plain Download button.
 */
export function SaveMediaButton({ item, className, label = true }: { item: MediaItem; className?: string; label?: boolean }) {
  const canShare = useCanShare();
  const { file, preparing } = useShareFile(item, canShare);
  const word = canShare ? "Save" : "Download";
  const onClick = async () => {
    if (file) {
      try {
        await navigator.share({ files: [file], title: item.title });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    download(item);
  };
  const Icon = preparing ? LoaderCircle : file ? Share : Download;
  return (
    <button type="button" onClick={onClick} aria-label={`${word} ${item.title}`} title={preparing ? "Getting the file ready…" : word} className={className}>
      <Icon className={cn("size-[18px]", preparing && "animate-spin")} />
      {label && <span>{word}</span>}
    </button>
  );
}
