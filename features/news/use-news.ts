"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsArticle, NewsPage, NewsScope } from "@/types/news";

export async function fetchNewsPage(params: { page: number; scope: NewsScope; q?: string }, signal?: AbortSignal): Promise<NewsPage> {
  const sp = new URLSearchParams({ page: String(params.page), scope: params.scope });
  if (params.q) sp.set("q", params.q);
  const res = await fetch(`/api/news?${sp}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `News is unavailable (${res.status})`);
  }
  return res.json();
}

interface FeedState {
  articles: NewsArticle[];
  page: number;
  hasMore: boolean;
  status: "idle" | "loading" | "loading-more" | "error";
  error: string | null;
}

/**
 * Paged news feed. Changing scope or query resets and refetches; `loadMore`
 * appends the next page (deduplicated by id).
 */
export function useNewsFeed({ scope, q, initial }: { scope: NewsScope; q: string; initial?: NewsPage | null }) {
  const key = `${scope}|${q}`;
  const initialMatches = initial && initial.scope === scope && (initial.query ?? "") === q;
  const [state, setState] = useState<FeedState>(() =>
    initialMatches
      ? { articles: initial!.articles, page: 1, hasMore: initial!.hasMore, status: "idle", error: null }
      : { articles: [], page: 0, hasMore: true, status: "loading", error: null },
  );
  const [loadedKey, setLoadedKey] = useState(initialMatches ? key : "");
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(
    async (page: number, append: boolean) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setState((s) => ({ ...s, status: append ? "loading-more" : "loading", error: null, ...(append ? {} : { articles: [] }) }));
      try {
        const data = await fetchNewsPage({ page, scope, q: q || undefined }, ctrl.signal);
        setState((s) => {
          const seen = new Set(append ? s.articles.map((a) => a.id) : []);
          const merged = append ? [...s.articles, ...data.articles.filter((a) => !seen.has(a.id))] : data.articles;
          return { articles: merged, page, hasMore: data.hasMore && data.articles.length > 0, status: "idle", error: null };
        });
        setLoadedKey(key);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState((s) => ({ ...s, status: "error", error: (e as Error).message }));
      }
    },
    [scope, q, key],
  );

  useEffect(() => {
    if (loadedKey === key) return;
    load(1, false);
  }, [key, loadedKey, load]);

  useEffect(() => () => abort.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (state.status === "idle" && state.hasMore) load(state.page + 1, true);
  }, [state.status, state.hasMore, state.page, load]);

  const retry = useCallback(() => load(state.articles.length ? state.page + 1 : 1, state.articles.length > 0), [load, state.articles.length, state.page]);

  return { ...state, loadMore, retry };
}
