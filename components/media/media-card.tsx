"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { CATEGORY_BY_SLUG } from "@/data/categories";
import { cn } from "@/lib/cn";
import { formatBytes, formatDate, formatDuration, formatResolution, resolutionTier } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/controls";
import { useContextMenu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { MediaThumb, mediaDuration } from "./media-thumb";
import { FavoriteButton } from "./favorite-button";
import { viewerHref } from "./media-links";
import { useLightbox } from "./lightbox-context";

export type CardLayout = "grid" | "compact" | "list" | "rail";

interface Props {
  item: MediaItem;
  /** Siblings for lightbox previous/next. */
  group: MediaItem[];
  index: number;
  layout?: CardLayout;
  sizes?: string;
  priority?: boolean;
}

const SIZES: Record<CardLayout, string> = {
  grid: "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 100vw",
  compact: "(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw",
  list: "160px",
  rail: "(min-width: 768px) 320px, 70vw",
};

export function MediaCard({ item, group, index, layout = "grid", sizes, priority }: Props) {
  const { open } = useLightbox();
  const router = useRouter();
  const toast = useToast();
  const menu = useContextMenu();
  const tier = resolutionTier(item.width, item.height);
  const category = CATEGORY_BY_SLUG[item.category];
  const detailHref = `/media/${item.slug}`;

  const onContextMenu = (e: React.MouseEvent) =>
    menu.open(e, [
      { label: "Preview", onSelect: () => open(group, index) },
      { label: "Open details", onSelect: () => router.push(detailHref) },
      { label: "Open in Media Viewer", onSelect: () => router.push(viewerHref(item.slug)) },
      { type: "separator" },
      {
        label: "Copy link",
        onSelect: () => {
          navigator.clipboard.writeText(new URL(detailHref, window.location.origin).toString()).then(
            () => toast("Link copied"),
            () => toast("Couldn't copy link", { tone: "error" }),
          );
        },
      },
      { label: "Open original in new tab", onSelect: () => window.open(item.original.url, "_blank", "noopener") },
    ]);

  const preview = (
    <button
      type="button"
      onClick={() => open(group, index)}
      aria-label={`Preview ${item.title}`}
      className={cn("block w-full rounded-lg text-left", layout === "list" && "w-40 shrink-0 sm:w-48")}
    >
      <MediaThumb item={item} sizes={sizes ?? SIZES[layout]} priority={priority} aspect={layout === "rail" || layout === "list" ? "16 / 9" : "16 / 10"} />
    </button>
  );

  const actions = (
    <div
      className={cn(
        "flex items-center gap-0.5",
        layout !== "list" && "opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
      )}
    >
      <Tooltip content="Open in Media Viewer">
        <Link href={viewerHref(item.slug)} aria-label={`Open ${item.title} in Media Viewer`} className={buttonClass({ variant: "ghost", size: "icon-sm" })}>
          <ScanSearch />
        </Link>
      </Tooltip>
      <FavoriteButton slug={item.slug} title={item.title} />
    </div>
  );

  if (layout === "list") {
    return (
      <article className="group flex items-center gap-4 rounded-lg p-2 transition-colors duration-150 hover:bg-surface" onContextMenu={onContextMenu}>
        {preview}
        <div className="min-w-0 flex-1">
          <Link href={detailHref} className="line-clamp-1 text-[14.5px] font-semibold text-text hover:underline hover:decoration-border-strong hover:underline-offset-4">
            {item.title}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {category?.singular} · {item.source.label} · {formatDate(item.datePublished, "short")}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
            {item.width && <span>{formatResolution(item.width, item.height)}</span>}
            {mediaDuration(item) && <span>{formatDuration(mediaDuration(item))}</span>}
            {item.video && <span>{item.video.fps} fps</span>}
            <span>{formatBytes(item.original.bytes)}</span>
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {tier && <Badge tone="outline">{tier}</Badge>}
          {item.verification === "sample" && <Badge tone="sample">Sample</Badge>}
        </div>
        {actions}
        {menu.element}
      </article>
    );
  }

  return (
    <article className={cn("group relative", layout === "rail" && "w-[70vw] shrink-0 snap-start xs:w-[300px] md:w-[320px]")} onContextMenu={onContextMenu}>
      {preview}
      <div className="pointer-events-none absolute top-2 left-2 flex gap-1">
        {tier && layout !== "compact" && <Badge className="bg-black/55 text-white/90 backdrop-blur-sm">{tier}</Badge>}
        {item.verification === "sample" && <Badge className="bg-black/55 text-[#f3c877] backdrop-blur-sm">Sample</Badge>}
      </div>
      {layout !== "compact" ? (
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={detailHref}
              className="line-clamp-1 text-[14px] leading-snug font-semibold text-text hover:underline hover:decoration-border-strong hover:underline-offset-4"
            >
              {item.title}
            </Link>
            <p className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">
              {category?.singular} · {formatDate(item.datePublished, "short")}
            </p>
          </div>
          <div className="-mt-1 -mr-1.5">{actions}</div>
        </div>
      ) : (
        <Link href={detailHref} className="mt-1.5 line-clamp-1 block text-[12.5px] font-medium text-muted hover:text-text">
          {item.title}
        </Link>
      )}
      {menu.element}
    </article>
  );
}
