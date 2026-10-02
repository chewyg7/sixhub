"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewsArticle, NewsPage } from "@/types/news";
import { buildIndex, searchIndex, type SearchDoc } from "./engine";

/* ------------------------------------------------------------------ */
/* Static index (fetched once per session)                             */
/* ------------------------------------------------------------------ */
let indexPromise: Promise<ReturnType<typeof buildIndex>> | null = null;

export function loadSearchIndex() {
  indexPromise ??= fetch("/api/search-index")
    .then((r) => {
      if (!r.ok) throw new Error(`Search index unavailable (${r.status})`);
      return r.json() as Promise<{ docs: SearchDoc[] }>;
    })
    .then((d) => buildIndex(d.docs))
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

export function newsToDoc(a: NewsArticle): SearchDoc {
  return {
    id: a.id,
    type: "news",
    title: a.title,
    subtitle: `${a.source.name} · ${new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    href: a.url,
    text: `${a.excerpt} ${a.categories.join(" ")}`,
    thumb: a.image?.url,
    date: a.publishedAt,
    external: true,
  };
}

const newsCache = new Map<string, Promise<SearchDoc[]>>();
function searchNews(q: string): Promise<SearchDoc[]> {
  const key = q.toLowerCase();
  if (!newsCache.has(key)) {
    const p = fetch(`/api/news?q=${encodeURIComponent(q)}&scope=gta6`)
      .then((r) => (r.ok ? (r.json() as Promise<NewsPage>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => d.articles.map(newsToDoc));
    newsCache.set(key, p);
    p.catch(() => newsCache.delete(key));
  }
  return newsCache.get(key)!;
}

export interface SearchState {
  results: SearchDoc[];
  /** Static index still loading. */
  loading: boolean;
  /** Live news search in flight. */
  newsLoading: boolean;
  error: string | null;
  newsError: boolean;
  retry: () => void;
}

/**
 * Instant results from the local index, plus live news results from the
 * RSS search endpoint once the query settles (debounced).
 */
export function useSearch(query: string, { news = true }: { news?: boolean } = {}): SearchState {
  const [index, setIndex] = useState<ReturnType<typeof buildIndex> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [newsState, setNewsState] = useState<{ q: string; docs: SearchDoc[]; error: boolean } | null>(null);
  const q = query.trim();

  useEffect(() => {
    let cancelled = false;
    loadSearchIndex().then(
      (ix) => !cancelled && (setIndex(ix), setError(null)),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!news || q.length < 3) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      searchNews(q).then(
        (docs) => !cancelled && setNewsState({ q, docs, error: false }),
        () => !cancelled && setNewsState({ q, docs: [], error: true }),
      );
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, news]);

  const local = useMemo(() => (index && q ? searchIndex(index, q) : []), [index, q]);
  const newsDocs = newsState?.q === q ? newsState.docs : [];

  return {
    results: q ? [...local, ...newsDocs] : [],
    loading: !index && !error,
    newsLoading: news && q.length >= 3 && newsState?.q !== q,
    error,
    newsError: newsState?.q === q && newsState.error,
    retry: () => setAttempt((a) => a + 1),
  };
}
