import { AudioLines, Play } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { ResponsiveImage } from "./responsive-image";

interface Props {
  item: MediaItem;
  sizes: string;
  /** CSS aspect ratio of the frame. `auto` uses the media's own ratio. */
  aspect?: string;
  priority?: boolean;
  className?: string;
  showKind?: boolean;
  rounded?: string;
}

export function mediaDuration(item: MediaItem) {
  return item.video?.duration ?? item.audio?.duration;
}

/** A media frame with placeholder colour, blur-up, and a kind indicator. */
export function MediaThumb({ item, sizes, aspect = "16 / 9", priority, className, showKind = true, rounded = "rounded-lg" }: Props) {
  const ratio = aspect === "auto" && item.width && item.height ? `${item.width} / ${item.height}` : aspect;
  const transparent = item.original.hasAlpha;
  const duration = mediaDuration(item);
  return (
    <div
      className={cn("media-zoom relative isolate overflow-hidden bg-surface-2", transparent && "checker", rounded, className)}
      style={{
        aspectRatio: ratio,
        backgroundColor: transparent ? undefined : (item.dominantColor ?? undefined),
        backgroundImage: !transparent && item.blurDataUrl ? `url(${item.blurDataUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <ResponsiveImage item={item} sizes={sizes} priority={priority} fit={transparent ? "contain" : "cover"} className={transparent ? "p-[8%]" : undefined} />
      {showKind && item.kind !== "image" && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-[5px] bg-black/60 px-1.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {item.kind === "video" ? <Play className="size-3 fill-current" /> : <AudioLines className="size-3" />}
          <span className="tabular">{formatDuration(duration)}</span>
        </div>
      )}
    </div>
  );
}
