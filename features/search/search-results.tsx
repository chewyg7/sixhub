"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, ScanSearch, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { GROUP_LABEL, GROUP_ORDER, groupResults, highlight, type SearchDoc, type SearchDocType } from "./engine";
import { useSearch } from "./use-search";

export function SearchResults() {
  const params = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [type, setType] = useState<SearchDocType | "all">("all");
  const search = useSearch(input);
  const q = input.trim();

  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    window.history.replaceState(null, "", `/search${sp.size ? `?${sp}` : ""}`);
  }, [q]);

  const counts = useMemo(() => {
    const c = new Map<SearchDocType, number>();
    for (const d of search.results) c.set(d.type, (c.get(d.type) ?? 0) + 1);
    return c;
  }, [search.results]);
  const visible = type === "all" ? search.results : search.results.filter((d) => d.type === type);
  const grouped = groupResults(visible, Infinity).map((g) => ({ t: g.type, items: g.items }));

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          autoFocus
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search media, news, characters, locations…"
          className="h-14 w-full rounded-xl border border-border bg-surface pr-12 pl-12 text-[17px] transition-colors outline-none placeholder:text-faint focus:border-border-strong"
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1.5 text-muted hover:text-text"
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      {q && (
        <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Filter results by type">
          {(["all", ...GROUP_ORDER.filter((t) => counts.has(t))] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px]",
                type === t ? "bg-text font-medium text-bg" : "border border-border text-muted hover:text-text",
              )}
            >
              {t === "all" ? "All" : GROUP_LABEL[t]}
              <span className="tabular opacity-60">{t === "all" ? search.results.length : counts.get(t)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        {!q && <EmptyState compact title="Search the whole site" description="Media, characters, locations, collections, timeline events and live news from RockstarINTEL." />}
        {q && search.loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}
        {q && search.error && <ErrorState title="Search is unavailable" description={search.error} onRetry={search.retry} />}
        {q && !search.loading && !search.error && visible.length === 0 && !search.newsLoading && (
          <EmptyState title={`No results for “${q}”`} description="Try a character, location, trailer or media type." />
        )}

        {grouped.map((g) => (
          <section key={g.t} className="mb-10" aria-labelledby={`g-${g.t}`}>
            <h2 id={`g-${g.t}`} className="eyebrow mb-2">
              {GROUP_LABEL[g.t]} <span className="text-faint">· {g.items.length}</span>
            </h2>
            <ul className="divide-y divide-divider border-y border-divider">
              {g.items.map((d) => (
                <ResultRow key={d.id} doc={d} query={q} />
              ))}
            </ul>
          </section>
        ))}
        {q && search.newsLoading && <p className="text-[13px] text-faint">Searching news…</p>}
        {q && search.newsError && <p className="text-[13px] text-faint">News results are unavailable right now.</p>}
      </div>
    </div>
  );
}

function ResultRow({ doc, query }: { doc: SearchDoc; query: string }) {
  const inner = (
    <>
      {doc.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- small thumbnail from variants or news source
        <img src={doc.thumb} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded-md bg-surface-2 object-cover" />
      ) : (
        <span className="h-12 w-20 shrink-0 rounded-md bg-surface-2" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">
          {highlight(doc.title, query).map((p, i) =>
            p.hit ? (
              <mark key={i} className="bg-accent-soft text-text">
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>
        {doc.subtitle && <p className="truncate text-[12.5px] text-muted">{doc.subtitle}</p>}
      </div>
      {doc.external && <ArrowUpRight className="size-4 shrink-0 text-faint" />}
    </>
  );
  return (
    <li className="flex items-center gap-2">
      {doc.external ? (
        <a href={doc.href} target="_blank" rel="noopener" className="flex min-w-0 flex-1 items-center gap-4 py-3 hover:bg-surface/60">
          {inner}
        </a>
      ) : (
        <Link href={doc.href} className="flex min-w-0 flex-1 items-center gap-4 py-3 hover:bg-surface/60">
          {inner}
        </Link>
      )}
      {doc.slug && (
        <Link href={`/viewer?m=${doc.slug}`} aria-label={`Open ${doc.title} in Media Viewer`} className="rounded-md p-2 text-faint hover:bg-surface-hover hover:text-text">
          <ScanSearch className="size-4" />
        </Link>
      )}
    </li>
  );
}
