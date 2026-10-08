"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Grid3x3, List, Search, SlidersHorizontal, X } from "lucide-react";
import type { MediaCategorySlug, MediaItem } from "@/types/content";
import { useCategories } from "@/components/site-data";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Segmented, Select } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { MediaCard } from "@/components/media/media-card";
import { FilterPanel, FACET_TITLE, type FacetOption } from "./filter-panel";
import {
  activeFilterCount,
  facetCounts,
  FACET_KEYS,
  indexMedia,
  parseQuery,
  runQuery,
  serializeQuery,
  type ArchiveQuery,
  type FacetKey,
  type SortKey,
  type ViewMode,
} from "./query";

const PAGE = 48;
const SORT_LABEL: Record<SortKey, string> = { newest: "Newest", oldest: "Oldest", added: "Recently added", name: "Name", resolution: "Resolution" };

interface Props {
  items: MediaItem[];
  labels: { characters: Record<string, string>; locations: Record<string, string>; sources: Record<string, string> };
  /** On /media/<category>, the category is fixed by the route. */
  category?: MediaCategorySlug;
}

export function ArchiveView({ items, labels, category }: Props) {
  const params = useSearchParams();
  const [query, setQuery] = useState<ArchiveQuery>(() => parseQuery(new URLSearchParams(params.toString()), category ? { category: [category] } : {}));
  const [limit, setLimit] = useState(PAGE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => indexMedia(items, labels), [items, labels]);
  const results = useMemo(() => runQuery(index, query), [index, query]);
  const counts = useMemo(() => facetCounts(index, query), [index, query]);
  const categories = useCategories();

  const options = useMemo<Record<FacetKey, FacetOption[]>>(() => {
    const uniq = (vals: string[]) => [...new Set(vals)];
    return {
      category: categories.map((c) => ({ value: c.slug, label: c.label })),
      type: [
        { value: "image", label: "Images" },
        { value: "video", label: "Videos" },
        { value: "audio", label: "Audio" },
      ],
      character: uniq(items.flatMap((m) => m.characters))
        .map((v) => ({ value: v, label: labels.characters[v] ?? v }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      location: uniq(items.flatMap((m) => m.locations))
        .map((v) => ({ value: v, label: labels.locations[v] ?? v }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      source: uniq(items.map((m) => m.source.slug)).map((v) => ({ value: v, label: labels.sources[v] ?? v })),
      resolution: [],
      orientation: [
        { value: "landscape", label: "Landscape" },
        { value: "portrait", label: "Portrait" },
        { value: "square", label: "Square" },
      ],
      tag: uniq(items.flatMap((m) => m.tags)).map((v) => ({ value: v, label: v })),
    };
  }, [items, labels, categories]);

  const labelFor = useCallback((key: FacetKey, value: string) => options[key].find((o) => o.value === value)?.label ?? value, [options]);

  // URL <-> state. replaceState keeps history clean while typing.
  useEffect(() => {
    const sp = serializeQuery(query, Boolean(category));
    const next = `${window.location.pathname}${sp.size ? `?${sp}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [query, category]);

  const update = useCallback((patch: Partial<ArchiveQuery>) => {
    setQuery((q) => ({ ...q, ...patch }));
    setLimit(PAGE);
  }, []);

  const toggle = useCallback((key: FacetKey, value: string) => {
    setQuery((q) => {
      const cur = q[key] as string[];
      return { ...q, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
    setLimit(PAGE);
  }, []);

  const clearAll = () => update({ ...Object.fromEntries(FACET_KEYS.map((k) => [k, k === "category" && category ? [category] : []])), from: "", to: "", q: "" });

  // Incremental rendering: grow the rendered window as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [results.length]);

  const shown = results.slice(0, limit);
  const nActive = activeFilterCount(query, Boolean(category));
  const chips: { key: FacetKey | "from" | "to"; value: string; label: string }[] = [
    ...FACET_KEYS.flatMap((k) => (k === "category" && category ? [] : (query[k] as string[]).map((v) => ({ key: k, value: v, label: `${FACET_TITLE[k]}: ${labelFor(k, v)}` })))),
    ...(query.from ? [{ key: "from" as const, value: query.from, label: `From ${formatDate(query.from, "short")}` }] : []),
    ...(query.to ? [{ key: "to" as const, value: query.to, label: `To ${formatDate(query.to, "short")}` }] : []),
  ];

  const panel = <FilterPanel query={query} options={options} counts={counts} onToggle={toggle} onDate={(k, v) => update({ [k]: v })} hideCategory={Boolean(category)} />;

  const gridClass: Record<ViewMode, string> = {
    grid: "grid grid-cols-1 gap-x-4 gap-y-7 xs:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
    compact: "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    list: "flex flex-col gap-1",
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 pb-6">
          <div className="flex items-center justify-between pb-1">
            <h2 className="eyebrow">Filters</h2>
            {nActive > 0 && (
              <button type="button" onClick={clearAll} className="text-[12px] font-medium text-muted hover:text-text">
                Clear all
              </button>
            )}
          </div>
          {panel}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-14 z-20 -mx-4 mb-4 bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search the archive</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={query.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder={category ? `Search ${categories.find((c) => c.slug === category)?.label.toLowerCase()}…` : "Search titles, characters, locations, tags…"}
                className="h-9 w-full rounded-md border border-border bg-surface pr-8 pl-8 text-[14px] text-text transition-colors outline-none placeholder:text-faint hover:border-border-strong focus:border-border-strong"
              />
              {query.q && (
                <button
                  type="button"
                  onClick={() => update({ q: "" })}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted hover:text-text"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
            <Button size="md" variant="outline" className="lg:hidden" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal /> Filters{nActive > 0 && <span className="tabular rounded-[4px] bg-accent-soft px-1.5 text-[11px] text-accent-text">{nActive}</span>}
            </Button>
            <Select aria-label="Sort by" value={query.sort} onChange={(e) => update({ sort: e.target.value as SortKey })} className="h-9">
              {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </Select>
            <Segmented
              label="Layout"
              value={query.view}
              onChange={(v) => update({ view: v })}
              options={[
                { value: "grid", label: <LayoutGrid aria-label="Grid" />, title: "Grid" },
                { value: "compact", label: <Grid3x3 aria-label="Compact grid" />, title: "Compact grid" },
                { value: "list", label: <List aria-label="List" />, title: "List" },
              ]}
            />
          </div>
          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <button
                  key={`${c.key}:${c.value}`}
                  type="button"
                  onClick={() => (c.key === "from" || c.key === "to" ? update({ [c.key]: "" }) : toggle(c.key, c.value))}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-surface-3 pr-1.5 pl-2.5 text-[12px] text-text transition-colors hover:bg-surface-hover"
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <X className="size-3.5 text-muted" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="h-7 px-2 text-[12px] font-medium text-muted hover:text-text">
                Clear all
              </button>
            </div>
          )}
        </div>

        <p className="mb-4 text-[12.5px] text-muted" aria-live="polite">
          {pluralize(results.length, "result")}
          {query.q && ` for “${query.q}”`}
        </p>

        {results.length === 0 ? (
          <EmptyState
            title="No media matches these filters"
            description="Remove a filter or broaden your search."
            action={
              <Button size="sm" onClick={clearAll}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <div className={cn(gridClass[query.view])}>
            {shown.map((m, i) => (
              <div key={m.slug} style={{ contentVisibility: "auto", containIntrinsicSize: query.view === "list" ? "auto 110px" : "auto 280px" }}>
                <MediaCard item={m} group={results} index={i} layout={query.view} priority={i < 4} />
              </div>
            ))}
          </div>
        )}
        {limit < results.length && <div ref={sentinel} className="h-10" aria-hidden />}
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        headerExtra={
          nActive > 0 ? (
            <button type="button" onClick={clearAll} className="px-2 text-[12.5px] font-medium text-muted hover:text-text">
              Clear all
            </button>
          ) : null
        }
      >
        <div className="px-4 pb-4">{panel}</div>
        <div className="sticky bottom-0 border-t border-divider bg-[var(--glass-3)] p-3">
          <Button variant="primary" size="lg" className="w-full" onClick={() => setSheetOpen(false)}>
            Show {pluralize(results.length, "result")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
