"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { IconButton } from "@/components/ui/icon-button";
import { MediaCard } from "./media-card";

/** Horizontally scrolling media row with snap points and edge-aware arrows. */
interface Props {
  items: MediaItem[];
  label: string;
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  linkLabel?: string;
}

export function MediaRail({ items, label, title, description, href, linkLabel = "View all" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="display text-[28px] sm:text-[32px]">{title}</h2>
          {description && <p className="mt-1.5 text-[14px] text-muted">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {href && (
            <Link href={href} className="text-[13px] font-medium text-muted transition-colors hover:text-text">
              {linkLabel}
            </Link>
          )}
          <div className="hidden gap-1 md:flex">
            <IconButton label="Scroll left" variant="outline" size="icon-sm" onClick={() => scroll(-1)} disabled={edges.start}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Scroll right" variant="outline" size="icon-sm" onClick={() => scroll(1)} disabled={edges.end}>
              <ChevronRight />
            </IconButton>
          </div>
        </div>
      </div>
      <div
        ref={ref}
        onScroll={update}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
      >
        {items.map((m, i) => (
          <MediaCard key={m.slug} item={m} group={items} index={i} layout="rail" />
        ))}
      </div>
    </div>
  );
}
