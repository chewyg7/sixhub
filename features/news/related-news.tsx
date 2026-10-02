"use client";

import Link from "next/link";
import type { NewsPage } from "@/types/news";
import { cn } from "@/lib/cn";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { NewsCard, NewsCardSkeleton } from "@/components/news/news-card";
import { useNewsFeed } from "./use-news";

interface Props {
  /** Live search query; empty for the latest GTA VI coverage. */
  query?: string;
  limit?: number;
  layout?: "compact" | "card";
  initial?: NewsPage | null;
  className?: string;
  emptyLabel?: string;
}

/** Live news block used on the homepage, database entries and timeline. */
export function RelatedNews({ query = "", limit = 5, layout = "compact", initial, className, emptyLabel }: Props) {
  const feed = useNewsFeed({ scope: "gta6", q: query, initial });
  const items = feed.articles.slice(0, limit);

  if (feed.status === "loading") {
    return (
      <div aria-busy="true" className={cn(layout === "card" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "divide-y divide-divider", className)}>
        {Array.from({ length: Math.min(limit, layout === "card" ? 3 : 4) }, (_, i) => (
          <NewsCardSkeleton key={i} layout={layout} />
        ))}
      </div>
    );
  }
  if (feed.status === "error" && items.length === 0) {
    return <ErrorState compact className={className} title="News is unavailable" description={feed.error} onRetry={feed.retry} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        className={className}
        title={emptyLabel ?? "No related coverage yet"}
        description={
          <>
            Browse all{" "}
            <Link className="link-underline text-text" href="/news">
              GTA VI news
            </Link>
            .
          </>
        }
      />
    );
  }
  return (
    <div className={cn(layout === "card" ? "grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" : "divide-y divide-divider", className)}>
      {items.map((a) => (
        <NewsCard key={a.id} article={a} layout={layout} />
      ))}
    </div>
  );
}
