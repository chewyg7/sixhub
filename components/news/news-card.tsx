"use client";

import { useSyncExternalStore } from "react";
import { ArrowUpRight, Newspaper } from "lucide-react";
import type { NewsArticle } from "@/types/news";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { Skeleton } from "@/components/ui/states";

const minuteTick = (cb: () => void) => {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
};

/** Absolute (UTC) date on the server, relative on the client — no hydration mismatch. */
export function NewsTime({ iso, className }: { iso: string; className?: string }) {
  const label = useSyncExternalStore(
    minuteTick,
    () => formatRelative(iso),
    () => formatDate(iso, "short"),
  );
  const title = useSyncExternalStore(
    minuteTick,
    () => formatDateTime(iso),
    () => formatDate(iso),
  );
  return (
    <time dateTime={iso} title={title} className={className}>
      {label}
    </time>
  );
}

function NewsImage({ article, className, sizes }: { article: NewsArticle; className?: string; sizes?: string }) {
  if (!article.image) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-2 text-faint", className)}>
        <Newspaper className="size-6" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn("media-zoom overflow-hidden bg-surface-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote editorial images from the news source */}
      <img
        src={article.image.url}
        alt={article.image.alt ?? ""}
        sizes={sizes}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="fade-in-img h-full w-full object-cover"
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) el.dataset.loaded = "true";
        }}
        onLoad={(e) => (e.currentTarget.dataset.loaded = "true")}
        onError={(e) => {
          // Hide broken remote images gracefully.
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}

interface Props {
  article: NewsArticle;
  layout?: "feature" | "card" | "row" | "compact";
  className?: string;
}

/** Every news card links to the original article on the publisher's site. */
export function NewsCard({ article, layout = "card", className }: Props) {
  const meta = (
    <p className="flex items-center gap-1.5 text-[12px] text-muted">
      <span className="font-semibold text-text/80">{article.source.name}</span>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <NewsTime iso={article.publishedAt} />
    </p>
  );

  if (layout === "compact") {
    return (
      <a href={article.url} target="_blank" rel="noopener" className={cn("group flex gap-3 rounded-lg py-3", className)}>
        <NewsImage article={article} className="aspect-[4/3] w-24 shrink-0 rounded-md" sizes="96px" />
        <div className="min-w-0">
          <h3 className="line-clamp-3 text-[14px] leading-snug font-semibold text-text transition-colors group-hover:text-accent-text">{article.title}</h3>
          <div className="mt-1.5">{meta}</div>
        </div>
      </a>
    );
  }

  if (layout === "row") {
    return (
      <article className={cn("group relative grid grid-cols-[1fr_auto] gap-4 border-b border-divider py-5 sm:grid-cols-[220px_1fr] sm:gap-6", className)}>
        <NewsImage
          article={article}
          className="order-2 aspect-[4/3] w-24 rounded-md sm:order-none sm:aspect-[16/10] sm:w-auto sm:rounded-lg"
          sizes="(min-width: 640px) 220px, 96px"
        />
        <div className="min-w-0">
          {meta}
          <h3 className="mt-1.5 text-[17px] leading-snug font-semibold text-text sm:text-[19px]">
            <a
              href={article.url}
              target="_blank"
              rel="noopener"
              className="group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4 after:absolute after:inset-0"
            >
              {article.title}
            </a>
          </h3>
          <p className="mt-2 line-clamp-2 hidden text-[14px] leading-relaxed text-muted sm:block">{article.excerpt}</p>
          <span className="mt-2 hidden items-center gap-1 text-[12.5px] font-medium text-muted transition-colors group-hover:text-text sm:inline-flex">
            Read on {article.source.name} <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </article>
    );
  }

  if (layout === "feature") {
    return (
      <article className={cn("group relative overflow-hidden rounded-xl", className)}>
        <NewsImage article={article} className="aspect-[16/9] w-full" sizes="(min-width: 1024px) 60vw, 100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
          <p className="flex items-center gap-1.5 text-[12px] text-white/75">
            <span className="font-semibold text-white">{article.source.name}</span> · <NewsTime iso={article.publishedAt} />
          </p>
          <h3 className="display mt-2 max-w-3xl text-[28px] sm:text-[38px]">
            <a href={article.url} target="_blank" rel="noopener" className="after:absolute after:inset-0">
              {article.title}
            </a>
          </h3>
          <p className="mt-3 line-clamp-2 hidden max-w-2xl text-[14.5px] leading-relaxed text-white/75 sm:block">{article.excerpt}</p>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <NewsImage article={article} className="aspect-[16/10] w-full rounded-lg" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
      <div className="mt-3">{meta}</div>
      <h3 className="mt-1.5 line-clamp-3 text-[16px] leading-snug font-semibold text-text">
        <a
          href={article.url}
          target="_blank"
          rel="noopener"
          className="group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4 after:absolute after:inset-0"
        >
          {article.title}
        </a>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{article.excerpt}</p>
    </article>
  );
}

export function NewsCardSkeleton({ layout = "card" }: { layout?: Props["layout"] }) {
  if (layout === "compact")
    return (
      <div className="flex gap-3 py-3">
        <Skeleton className="aspect-[4/3] w-24 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
    );
  if (layout === "row")
    return (
      <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-divider py-5 sm:grid-cols-[220px_1fr] sm:gap-6">
        <Skeleton className="order-2 aspect-[4/3] w-24 sm:order-none sm:aspect-[16/10] sm:w-auto" />
        <div className="space-y-2.5">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="hidden h-3 w-full sm:block" />
        </div>
      </div>
    );
  return (
    <div>
      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      <Skeleton className="mt-3 h-2.5 w-28" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
    </div>
  );
}
