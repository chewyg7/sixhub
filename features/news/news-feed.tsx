"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { NewsPage, NewsScope } from "@/types/news";
import { SITE } from "@/lib/site";
import { Segmented, Select } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { NewsCard, NewsCardSkeleton } from "@/components/news/news-card";
import { useNewsFeed } from "./use-news";

type Range = "any" | "24h" | "7d" | "30d" | "custom";
const RANGE_LABEL: Record<Range, string> = { any: "Any time", "24h": "Past 24 hours", "7d": "Past week", "30d": "Past month", custom: "Custom range" };
const MAX_AUTO_PAGES = 12;

function rangeBounds(range: Range, from: string, to: string, now: number): [number, number] {
  const day = 86_400_000;
  switch (range) {
    case "24h":
      return [now - day, Infinity];
    case "7d":
      return [now - 7 * day, Infinity];
    case "30d":
      return [now - 30 * day, Infinity];
    case "custom":
      return [from ? Date.parse(`${from}T00:00:00`) : -Infinity, to ? Date.parse(`${to}T23:59:59`) : Infinity];
    default:
      return [-Infinity, Infinity];
  }
}

export function NewsFeed({ initial }: { initial: NewsPage | null }) {
  const params = useSearchParams();
  const [scope, setScope] = useState<NewsScope>(params.get("scope") === "all" ? "all" : "gta6");
  const [input, setInput] = useState(params.get("q") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [range, setRange] = useState<Range>((params.get("range") as Range) || "any");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [now] = useState(() => Date.now());
  const feed = useNewsFeed({ scope, q, initial });
  const sentinel = useRef<HTMLDivElement>(null);

  // Debounce the query that hits the server search.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 350);
    return () => window.clearTimeout(t);
  }, [input]);

  // Reflect filters in the URL so views are shareable.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (scope !== "gta6") sp.set("scope", scope);
    if (range !== "any") sp.set("range", range);
    if (range === "custom" && from) sp.set("from", from);
    if (range === "custom" && to) sp.set("to", to);
    const next = `${window.location.pathname}${sp.size ? `?${sp}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [q, scope, range, from, to]);

  const [start, end] = rangeBounds(range, from, to, now);
  const visible = useMemo(
    () =>
      feed.articles.filter((a) => {
        const t = Date.parse(a.publishedAt);
        return t >= start && t <= end;
      }),
    [feed.articles, start, end],
  );

  // For date filters, keep paging back until the window is covered.
  const oldest = feed.articles.length ? Date.parse(feed.articles[feed.articles.length - 1].publishedAt) : Infinity;
  const needsMoreForRange = range !== "any" && feed.hasMore && oldest > start && visible.length < 12 && feed.page < MAX_AUTO_PAGES;
  useEffect(() => {
    if (needsMoreForRange && feed.status === "idle") feed.loadMore();
  }, [needsMoreForRange, feed]);

  // Infinite loading when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && feed.loadMore(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  const filtersActive = q || range !== "any";
  const showFeature = !filtersActive && visible.length > 3;
  const reachedEndOfRange = range !== "any" && oldest < start;

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-divider bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border sm:px-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search news</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search news…"
              className="h-9 w-full rounded-md border border-border bg-surface pr-8 pl-8 text-[14px] text-text transition-colors outline-none placeholder:text-faint hover:border-border-strong focus:border-border-strong"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted hover:text-text"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Coverage"
              value={scope}
              onChange={setScope}
              options={[
                { value: "gta6", label: "GTA VI" },
                { value: "all", label: "All Rockstar" },
              ]}
            />
            <Select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <option key={r} value={r}>
                  {RANGE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {range === "custom" && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <label className="flex items-center gap-2">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2 text-text [color-scheme:inherit]"
              />
            </label>
            <label className="flex items-center gap-2">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2 text-text [color-scheme:inherit]"
              />
            </label>
          </div>
        )}
      </div>

      <p className="mb-2 text-[12.5px] text-muted" aria-live="polite">
        {feed.status === "loading"
          ? "Loading articles…"
          : filtersActive
            ? `${visible.length} ${visible.length === 1 ? "article" : "articles"}${q ? ` matching “${q}”` : ""}${range !== "any" ? ` · ${RANGE_LABEL[range].toLowerCase()}` : ""}`
            : `Latest ${scope === "gta6" ? "GTA VI" : "Rockstar"} coverage from ${SITE.newsSource.name}`}
      </p>

      {feed.status === "loading" && (
        <div aria-busy="true">
          <div className="skeleton mb-2 aspect-[16/9] w-full rounded-xl" />
          {Array.from({ length: 4 }, (_, i) => (
            <NewsCardSkeleton key={i} layout="row" />
          ))}
        </div>
      )}

      {feed.status === "error" && feed.articles.length === 0 && (
        <ErrorState
          title="Couldn't load the news feed"
          description={
            <>
              {feed.error}. The feed is fetched from {SITE.newsSource.name}; it may be temporarily unavailable.
            </>
          }
          onRetry={feed.retry}
        />
      )}

      {feed.status !== "loading" && !(feed.status === "error" && feed.articles.length === 0) && (
        <>
          {visible.length === 0 && !needsMoreForRange && feed.status === "idle" && (
            <EmptyState
              title="No articles found"
              description={
                q
                  ? `Nothing matched “${q}”${range !== "any" ? " in this date range" : ""}. Try a broader search or switch to all Rockstar coverage.`
                  : "No articles were published in this date range."
              }
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setInput("");
                    setRange("any");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
          {showFeature && <NewsCard article={visible[0]} layout="feature" className="mb-2" />}
          <div>
            {(showFeature ? visible.slice(1) : visible).map((a) => (
              <NewsCard key={a.id} article={a} layout="row" />
            ))}
          </div>
          {(feed.status === "loading-more" || needsMoreForRange) && (
            <div aria-busy="true">
              <NewsCardSkeleton layout="row" />
              <NewsCardSkeleton layout="row" />
            </div>
          )}
          {feed.status === "error" && feed.articles.length > 0 && (
            <ErrorState compact className="mt-6" title="Couldn't load more articles" description={feed.error} onRetry={feed.retry} />
          )}
          <div ref={sentinel} className="h-px" />
          {feed.status === "idle" && feed.hasMore && !reachedEndOfRange && visible.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Button onClick={feed.loadMore}>Load older articles</Button>
            </div>
          )}
          {feed.status === "idle" && (!feed.hasMore || reachedEndOfRange) && visible.length > 0 && (
            <p className="mt-8 text-center text-[12.5px] text-faint">You&apos;re all caught up for this view.</p>
          )}
        </>
      )}
    </div>
  );
}
