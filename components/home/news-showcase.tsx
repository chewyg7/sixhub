"use client";

import type { NewsArticle, NewsPage } from "@/types/news";
import { cn } from "@/lib/cn";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { NewsTime } from "@/components/news/news-card";
import { useNewsFeed } from "@/features/news/use-news";
import { Stagger } from "@/components/motion/reveal";

function Img({ a, className, sizes }: { a: NewsArticle; className?: string; sizes: string }) {
  return (
    <div className={cn("overflow-hidden bg-surface-2", className)}>
      {a.image && (
        // eslint-disable-next-line @next/next/no-img-element -- remote editorial image from the publisher
        <img
          src={a.image.url}
          alt={a.image.alt ?? ""}
          sizes={sizes}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]"
        />
      )}
    </div>
  );
}

/** The four newest stories as simple cards. Live from the RSS feed. */
export function NewsShowcase({ initial }: { initial: NewsPage | null }) {
  const feed = useNewsFeed({ scope: "gta6", q: "", initial });

  if (feed.status === "loading")
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[16/11] w-full rounded-3xl" />
        ))}
      </div>
    );
  if (feed.status === "error" && !feed.articles.length) return <ErrorState title="News is unavailable right now" description={feed.error} onRetry={feed.retry} />;
  if (!feed.articles.length) return null;

  return (
    <Stagger as="ol" className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
      {feed.articles.slice(0, 4).map((a) => (
        <li key={a.id}>
          <a href={a.url} target="_blank" rel="noopener" className="group block">
            <Img a={a} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="aspect-[16/10] rounded-3xl" />
            <p className="mt-4 text-[14px] text-muted">
              {a.source.name} · <NewsTime iso={a.publishedAt} />
            </p>
            <h3 className="mt-1.5 line-clamp-2 text-[17px] leading-snug font-bold text-text transition-colors group-hover:text-accent-text">{a.title}</h3>
          </a>
        </li>
      ))}
    </Stagger>
  );
}
