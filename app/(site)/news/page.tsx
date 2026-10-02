import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { Container, PageHeader } from "@/components/layout/page";
import { NewsCardSkeleton } from "@/components/news/news-card";
import { NewsFeed } from "@/features/news/news-feed";
import { fetchRockstarIntel } from "@/lib/news/rockstarintel";
import { SITE } from "@/lib/site";
import type { NewsPage } from "@/types/news";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "News",
  description: `The latest Grand Theft Auto VI news, updated automatically from ${SITE.newsSource.name}.`,
  alternates: { canonical: "/news" },
};

export default async function NewsIndexPage() {
  let initial: NewsPage | null = null;
  try {
    initial = await fetchRockstarIntel({ scope: "gta6", page: 1 });
  } catch {
    // The client feed shows an error state with retry.
  }

  return (
    <Container className="max-w-[1100px]">
      <PageHeader
        eyebrow="Updated every 10 minutes"
        title="News"
        lede={
          <>
            GTA VI headlines from{" "}
            <a href={SITE.newsSource.url} target="_blank" rel="noopener" className="link-underline inline-flex items-center gap-0.5 text-text">
              {SITE.newsSource.name}
              <ArrowUpRight className="size-3.5" />
            </a>
            . Stories open on the publisher&apos;s site.
          </>
        }
      />
      <Suspense
        fallback={
          <div aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <NewsCardSkeleton key={i} layout="row" />
            ))}
          </div>
        }
      >
        <NewsFeed initial={initial} />
      </Suspense>
    </Container>
  );
}
