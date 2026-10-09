"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Copy, Download, Expand, Link2, ScanSearch, Share2 } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { library } from "@/features/library/store";
import { buttonClass } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { ZoomableImage, type ZoomHandle } from "./zoomable-image";
import { VideoPlayer } from "./player/video-player";
import { AudioPlayer } from "./player/audio-player";
import { FontTester, familyStyles } from "./font-tester";
import { SaveMediaButton } from "./save-media";
import { FavoriteButton } from "./favorite-button";
import { AddToCollection } from "./add-to-collection";
import { useLightbox } from "./lightbox-context";
import { viewerHref } from "./media-links";

/** Media stage for the detail page: zoomable image, custom video player or audio player. */
export function MediaStage({ item, family = [] }: { item: MediaItem; family?: MediaItem[] }) {
  const zoom = useRef<ZoomHandle>(null);
  const router = useRouter();
  useEffect(() => library.recordView(item.slug), [item.slug]);

  if (item.kind === "font") return <FontTester item={item} styles={familyStyles(item, family)} onPickStyle={(m) => router.push(`/media/${m.slug}`, { scroll: false })} />;

  if (item.kind === "video") return <VideoPlayer item={item} />;
  if (item.kind === "audio")
    return (
      <div className="rounded-xl border border-divider bg-surface p-5 sm:p-8">
        <AudioPlayer item={item} />
      </div>
    );

  const ratio = (item.width ?? 16) / (item.height ?? 9);
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-canvas"
      style={{ aspectRatio: ratio < 0.9 ? "4 / 5" : ratio > 2.2 ? "21 / 9" : `${item.width} / ${item.height}`, maxHeight: "78vh" }}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") zoom.current?.zoomIn();
        else if (e.key === "-") zoom.current?.zoomOut();
        else if (e.key === "0") zoom.current?.fit();
        else return;
        e.preventDefault();
      }}
      tabIndex={0}
      role="group"
      aria-label={`${item.title} — scroll or pinch to zoom, drag to pan`}
    >
      <ZoomableImage ref={zoom} item={item} className={item.original.hasAlpha ? "checker" : undefined} />
    </div>
  );
}

export function MediaActions({ item }: { item: MediaItem }) {
  const toast = useToast();
  const { open } = useLightbox();
  const absolute = (path: string) => new URL(path, window.location.origin).toString();

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast(`${label} copied`),
      () => toast(`Couldn't copy ${label.toLowerCase()}`, { tone: "error" }),
    );

  const share = async () => {
    const url = absolute(`/media/${item.slug}`);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${item.title} — GTA 6 Hub`, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    copy(url, "Link");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.kind !== "font" && (
        <Link href={viewerHref(item.slug)} className={buttonClass({ variant: "primary" })}>
          <ScanSearch /> Open in Media Viewer
        </Link>
      )}
      {item.kind === "image" && (
        <button type="button" onClick={() => open([item], 0)} className={buttonClass({ variant: "secondary" })}>
          <Expand /> View full resolution
        </button>
      )}
      <FavoriteButton slug={item.slug} title={item.title} variant="secondary" size="icon" />
      <AddToCollection slug={item.slug} title={item.title} iconOnly size="icon" />
      {item.downloadable && (
        // Phones: Save opens the share sheet (Save Image / Save to device).
        <SaveMediaButton item={item} className={buttonClass({ variant: "primary", className: "lg:hidden" })} />
      )}
      {item.downloadable && (
        <a
          href={item.original.url}
          download={item.original.filename}
          className={buttonClass({ variant: "secondary", size: "icon", className: "hidden lg:inline-flex" })}
          aria-label={`Download original (${item.original.filename})`}
          title="Download original"
        >
          <Download />
        </a>
      )}
      <IconButton label="Share" variant="secondary" onClick={share}>
        <Share2 />
      </IconButton>
      <Menu
        align="end"
        items={[
          { label: "Copy page link", icon: <Link2 />, onSelect: () => copy(absolute(`/media/${item.slug}`), "Link") },
          { label: "Copy source file URL", icon: <Copy />, onSelect: () => copy(absolute(item.original.url), "Source URL") },
          { label: "Copy Media Viewer link", icon: <ScanSearch />, onSelect: () => copy(absolute(viewerHref(item.slug)), "Viewer link") },
          ...(item.officialUrl
            ? [{ type: "separator" as const }, { label: "Open official Rockstar page", onSelect: () => window.open(item.officialUrl, "_blank", "noopener") }]
            : []),
        ]}
        trigger={(p) => (
          <button {...p} type="button" aria-label="More actions" className={buttonClass({ variant: "secondary", size: "icon" })}>
            <Copy />
          </button>
        )}
      />
    </div>
  );
}
