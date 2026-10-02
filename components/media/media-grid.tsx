"use client";

import type { MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { MediaCard, type CardLayout } from "./media-card";

export function MediaGrid({ items, layout = "grid", className, columns = 4 }: { items: MediaItem[]; layout?: Exclude<CardLayout, "rail">; className?: string; columns?: 3 | 4 }) {
  return (
    <div
      className={cn(
        layout === "list"
          ? "flex flex-col gap-1"
          : layout === "compact"
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            : cn("grid grid-cols-1 gap-x-4 gap-y-7 xs:grid-cols-2", columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"),
        className,
      )}
    >
      {items.map((m, i) => (
        <MediaCard key={m.slug} item={m} group={items} index={i} layout={layout} />
      ))}
    </div>
  );
}
