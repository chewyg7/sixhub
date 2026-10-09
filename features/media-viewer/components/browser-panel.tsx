"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns2, FolderOpen, Link2, Search, X } from "lucide-react";
import type { MediaCategorySlug, MediaItem } from "@/types/content";
import { useCategories } from "@/components/site-data";
import { normalize } from "@/features/search/engine";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { smallestVariant } from "@/lib/media/variants";
import { Button } from "@/components/ui/button";
import { useContextMenu } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useViewer } from "../store";
import { useViewerActions } from "../use-actions";

interface Props {
  items: MediaItem[];
  onOpenFile: (pane: "a" | "b") => void;
  /** Called after an item is chosen (mobile sheets close themselves). */
  onPicked?: () => void;
}

export function BrowserPanel({ items, onOpenFile, onPicked }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MediaCategorySlug | "all">("all");
  const categories = useCategories().filter((c) => items.some((m) => m.category === c.slug));
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const activeA = useViewer((s) => s.a?.slug);
  const activeB = useViewer((s) => (s.compare.enabled ? s.b?.slug : undefined));
  const actions = useViewerActions();
  const menu = useContextMenu();

  const list = useMemo(() => {
    const tokens = normalize(query).split(" ").filter(Boolean);
    return items
      .filter((m) => category === "all" || m.category === category)
      .filter((m) => {
        if (!tokens.length) return true;
        const hay = normalize(`${m.title} ${m.tags.join(" ")} ${m.source.label} ${m.kind}`);
        return tokens.every((t) => hay.includes(t));
      })
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  }, [items, query, category]);

  // Render in pages: a thousand thumbnails at once is enough to make iOS Safari reload the tab.
  const PAGE = 60;
  const filterKey = `${query}|${category}`;
  const [paging, setPaging] = useState({ key: filterKey, limit: PAGE });
  if (paging.key !== filterKey) setPaging({ key: filterKey, limit: PAGE });
  const shown = list.slice(0, paging.limit);
  const sentinel = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setPaging((p) => ({ ...p, limit: p.limit + PAGE })), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [paging.limit, list.length]);

  const pick = (m: MediaItem, pane: "a" | "b") => {
    actions.openArchive(m, pane);
    onPicked?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => onOpenFile("a")}>
            <FolderOpen /> Open file
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setUrlOpen((o) => !o)} aria-expanded={urlOpen}>
            <Link2 /> Paste URL
          </Button>
        </div>
        {urlOpen && (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (actions.openUrl(url)) {
                setUrl("");
                setUrlOpen(false);
                onPicked?.();
              }
            }}
          >
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/image.jpg or video.mp4"
              aria-label="Media URL"
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12.5px] outline-none focus:border-border-strong"
            />
            <Button type="submit" size="sm" variant="primary" disabled={!url.trim()}>
              Load
            </Button>
          </form>
        )}
        <label className="relative block">
          <span className="sr-only">Search media</span>
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archive…"
            className="h-8 w-full rounded-md border border-border bg-surface pr-7 pl-7 text-[12.5px] outline-none placeholder:text-faint focus:border-border-strong"
          />
          {query && (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 text-muted hover:text-text">
              <X className="size-3" />
            </button>
          )}
        </label>
        <div className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3" role="tablist" aria-label="Category">
          {["all", ...categories.map((c) => c.slug)].map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "h-7 shrink-0 rounded-md px-2.5 text-[12px] transition-colors",
                category === c ? "bg-text font-medium text-bg" : "text-muted hover:bg-surface-hover hover:text-text",
              )}
            >
              {c === "all"
                ? "All"
                : categories.find((x) => x.slug === c)?.label.replace("Official ", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {list.length === 0 ? (
          <p className="px-1 py-8 text-center text-[12.5px] text-muted">No media matches.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2" aria-label="Media">
            {shown.map((m) => {
              const isA = activeA === m.slug;
              const isB = activeB === m.slug;
              const thumb = smallestVariant(m, 320);
              return (
                <li key={m.slug} className="group relative">
                  <button
                    type="button"
                    onClick={() => pick(m, "a")}
                    onContextMenu={(e) =>
                      menu.open(e, [
                        { label: "Open", onSelect: () => pick(m, "a") },
                        { label: "Compare with current (B)", onSelect: () => pick(m, "b") },
                        { type: "separator" },
                        { label: "Open details page", onSelect: () => window.open(`/media/${m.slug}`, "_blank", "noopener") },
                      ])
                    }
                    aria-current={isA ? "true" : undefined}
                    aria-label={`Open ${m.title}`}
                    className="block w-full text-left"
                  >
                    <div
                      className={cn(
                        "relative aspect-[16/10] overflow-hidden rounded-md bg-surface-3 ring-offset-2 ring-offset-surface transition-shadow",
                        isA && "ring-2 ring-accent",
                        isB && !isA && "ring-2 ring-white/70",
                        m.original.hasAlpha && "checker",
                      )}
                      style={{ backgroundColor: m.original.hasAlpha ? undefined : (m.dominantColor ?? undefined) }}
                    >
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element -- small variant
                        <img
                          src={thumb.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className={cn("h-full w-full transition-transform duration-300 group-hover:scale-[1.04]", m.original.hasAlpha ? "object-contain p-2" : "object-cover")}
                        />
                      )}
                      {m.kind !== "image" && (
                        <span className="tabular absolute bottom-1 left-1 rounded-[4px] bg-black/65 px-1 font-mono text-[10px] text-white">
                          {formatDuration(m.video?.duration ?? m.audio?.duration)}
                        </span>
                      )}
                      {(isA || isB) && <span className="absolute top-1 left-1 rounded-[4px] bg-black/70 px-1.5 text-[10px] font-bold text-white">{isA ? "A" : "B"}</span>}
                    </div>
                    <p className={cn("mt-1 line-clamp-1 text-[11.5px]", isA ? "text-text" : "text-muted")}>{m.title}</p>
                  </button>
                  {!isA && m.kind !== "audio" && (
                    <Tooltip content="Compare with current (B)">
                      <button
                        type="button"
                        onClick={() => pick(m, "b")}
                        aria-label={`Compare ${m.title} with current`}
                        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-[5px] bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100"
                      >
                        <Columns2 className="size-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </li>
              );
            })}
            {list.length > shown.length && <li ref={sentinel} aria-hidden className="col-span-2 h-px" />}
          </ul>
        )}
      </div>
      {menu.element}
    </div>
  );
}
