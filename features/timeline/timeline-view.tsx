"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { Collection, MediaItem, TimelineEvent, TimelineEventType } from "@/types/content";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/controls";
import { MediaThumb } from "@/components/media/media-thumb";
import { useLightbox } from "@/components/media/lightbox-context";

export const EVENT_LABEL: Record<TimelineEventType, string> = {
  announcement: "Announcement",
  trailer: "Trailer",
  screenshots: "Screenshots",
  newswire: "Newswire",
  "release-date": "Release date",
  marketing: "Marketing",
  financial: "Financial",
};

interface Props {
  events: TimelineEvent[];
  collections: Record<string, Collection>;
  media: Record<string, MediaItem>;
}

export function TimelineView({ events, collections, media }: Props) {
  const [type, setType] = useState<TimelineEventType | "all">("all");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const { open } = useLightbox();
  const types = [...new Set(events.map((e) => e.type))];
  const list = events.filter((e) => type === "all" || e.type === type).sort((a, b) => (order === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const years = [...new Set(list.map((e) => e.date.slice(0, 4)))];

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center gap-1.5">
        {(["all", ...types] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(t)}
            className={cn("h-8 rounded-md px-3 text-[13px] transition-colors", type === t ? "bg-text font-medium text-bg" : "border border-border text-muted hover:text-text")}
          >
            {t === "all" ? "All events" : EVENT_LABEL[t]}
          </button>
        ))}
        <button type="button" onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))} className="ml-auto h-8 rounded-md px-2 text-[13px] text-muted hover:text-text">
          {order === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {years.map((year) => (
        <section key={year} aria-labelledby={`y-${year}`} className="grid gap-x-10 md:grid-cols-[120px_1fr]">
          <h2 id={`y-${year}`} className="display-tight mb-4 text-[44px] text-faint md:sticky md:top-24 md:mb-0 md:self-start">
            {year}
          </h2>
          <ol className="relative border-l border-divider pb-12">
            {list
              .filter((e) => e.date.startsWith(year))
              .map((e) => {
                const col = e.collectionSlug ? collections[e.collectionSlug] : undefined;
                const items = (col?.mediaSlugs ?? e.mediaSlugs ?? []).map((s) => media[s]).filter(Boolean);
                return (
                  <li key={e.id} id={e.id} className="relative scroll-mt-24 pb-10 pl-7 last:pb-0 target:[&_h3]:text-accent-text">
                    <span
                      className={cn(
                        "absolute top-1.5 -left-[5px] size-[9px] rounded-full ring-4 ring-bg",
                        e.type === "trailer" || e.type === "release-date" ? "bg-accent" : "bg-muted",
                      )}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={e.date} className="tabular text-[12.5px] text-muted">
                        {formatDate(e.date, e.datePrecision === "month" ? "month" : "long")}
                      </time>
                      <Badge>{EVENT_LABEL[e.type]}</Badge>
                      {e.verification === "reported" && <Badge tone="outline">Reported</Badge>}
                    </div>
                    <h3 className="mt-2 text-[20px] leading-snug font-semibold transition-colors">{e.title}</h3>
                    <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-muted">{e.summary}</p>
                    {items.length > 0 && (
                      <div className="mt-4 flex max-w-2xl gap-2">
                        {items.slice(0, 4).map((m, i) => (
                          <button key={m.slug} type="button" onClick={() => open(items, i)} aria-label={`Preview ${m.title}`} className="w-1/4 min-w-0">
                            <MediaThumb item={m} sizes="160px" aspect="16 / 10" rounded="rounded-md" />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                      {col && (
                        <Link href={`/collections/${col.slug}`} className="inline-flex items-center gap-0.5 font-medium text-text hover:underline hover:underline-offset-4">
                          {col.title} collection <ChevronRight className="size-3.5" />
                        </Link>
                      )}
                      {e.newsQuery && (
                        <Link href={`/news?q=${encodeURIComponent(e.newsQuery)}`} className="text-muted hover:text-text">
                          Related news
                        </Link>
                      )}
                      {e.sources.map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-muted hover:text-text">
                          {s.label} <ArrowUpRight className="size-3" />
                        </a>
                      ))}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </div>
  );
}
