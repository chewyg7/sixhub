"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Clock, CornerDownLeft, FileText, Film, Image as ImageIcon, Layers, MapPin, Search, User, CalendarDays, Newspaper, Compass, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useIsMac } from "@/lib/hooks/use-client";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/states";
import { GROUP_LABEL, groupResults, highlight, type SearchDoc, type SearchDocType } from "./engine";
import { useSearch, loadSearchIndex } from "./use-search";

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */
const Ctx = createContext<{ open: (q?: string) => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; initial: string }>({ open: false, initial: "" });
  const open = useCallback((q = "") => setState({ open: true, initial: q }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest?.("input,textarea,select,[contenteditable=true]");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setState((s) => ({ open: !s.open, initial: "" }));
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !document.querySelector('[aria-modal="true"]')) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const api = useMemo(() => ({ open }), [open]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {state.open && <CommandPalette initialQuery={state.initial} onClose={close} />}
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Recent searches                                                     */
/* ------------------------------------------------------------------ */
const RECENT_KEY = "gh:recent-searches";
function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 6);
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const list = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

const ICONS: Record<SearchDocType, typeof Search> = {
  media: ImageIcon,
  news: Newspaper,
  character: User,
  location: MapPin,
  info: FileText,
  collection: Layers,
  timeline: CalendarDays,
  page: Compass,
};

const QUICK_LINKS: SearchDoc[] = [
  { id: "q:viewer", type: "page", title: "Open Media Viewer", href: "/viewer" },
  { id: "q:media", type: "page", title: "Browse the media archive", href: "/media" },
  { id: "q:news", type: "page", title: "Latest news", href: "/news" },
  { id: "q:characters", type: "page", title: "Characters", href: "/info/characters" },
  { id: "q:timeline", type: "page", title: "Timeline", href: "/timeline" },
];

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */
function CommandPalette({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecent()));
  const isMac = useIsMac();
  const search = useSearch(query);

  useEffect(() => {
    loadSearchIndex().catch(() => {});
  }, []);

  const groups = useMemo(() => groupResults(search.results, 5), [search.results]);
  const flat = useMemo(() => (query.trim() ? groups.flatMap((g) => g.items) : QUICK_LINKS), [groups, query]);
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = (doc: SearchDoc, viewer = false) => {
    if (query.trim()) pushRecent(query.trim());
    onClose();
    if (viewer && doc.slug) router.push(`/viewer?m=${doc.slug}`);
    else if (doc.external) window.open(doc.href, "_blank", "noopener");
    else router.push(doc.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const doc = flat[activeIndex];
      if (doc) go(doc, e.shiftKey);
      else if (query.trim()) {
        pushRecent(query.trim());
        onClose();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  let idx = -1;
  const renderItem = (doc: SearchDoc) => {
    idx++;
    const i = idx;
    const Icon = doc.type === "media" && doc.subtitle?.startsWith("Video") ? Film : ICONS[doc.type];
    const isActive = i === activeIndex;
    return (
      <div
        key={doc.id}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={isActive}
        data-idx={i}
        onMouseMove={() => active !== i && setActive(i)}
        onClick={(e) => go(doc, e.shiftKey)}
        className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2", isActive && "bg-surface-hover")}
      >
        {doc.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail
          <img src={doc.thumb} alt="" className="h-9 w-14 shrink-0 rounded-[5px] bg-surface-3 object-cover" loading="lazy" />
        ) : (
          <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-[5px] bg-surface-2 text-muted [&_svg]:size-4">
            <Icon />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] text-text">
            {highlight(doc.title, query).map((p, k) =>
              p.hit ? (
                <mark key={k} className="bg-transparent font-semibold text-text underline decoration-accent/70 decoration-2 underline-offset-[3px]">
                  {p.text}
                </mark>
              ) : (
                <span key={k}>{p.text}</span>
              ),
            )}
          </p>
          {doc.subtitle && <p className="truncate text-[12px] text-muted">{doc.subtitle}</p>}
        </div>
        {isActive && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-faint">
            {doc.slug && (
              <>
                <Kbd>⇧</Kbd>
                <Kbd>↵</Kbd> Viewer
                <span className="mx-1" />
              </>
            )}
            {doc.external ? <ArrowUpRight className="size-3.5" /> : <CornerDownLeft className="size-3.5" />}
          </span>
        )}
      </div>
    );
  };

  const q = query.trim();

  return (
    <Dialog open onClose={onClose} title="Search GTA 6 Hub" hideTitle size="lg" placement="top" initialFocus={inputRef} className="max-h-[72vh]">
      <div className="flex items-center gap-3 border-b border-divider px-4">
        <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search media, news, characters, locations…"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat.length ? `${listId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          spellCheck={false}
          className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-faint"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="rounded p-1 text-muted hover:bg-surface-hover hover:text-text">
            <X className="size-4" />
          </button>
        )}
        <Kbd className="hidden sm:inline-flex">Esc</Kbd>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="Search results" className="max-h-[calc(72vh-104px)] overflow-y-auto p-2">
        {!q && (
          <>
            {recent.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
                  <span className="eyebrow text-[10.5px]">Recent searches</span>
                  <button
                    type="button"
                    className="text-[11.5px] text-faint hover:text-text"
                    onClick={() => {
                      localStorage.removeItem(RECENT_KEY);
                      setRecent([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQuery(r)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-surface-2 px-2.5 text-[12.5px] text-muted hover:bg-surface-hover hover:text-text"
                    >
                      <Clock className="size-3.5" />
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="eyebrow px-2.5 pt-1.5 pb-1 text-[10.5px]">Jump to</div>
            {QUICK_LINKS.map(renderItem)}
          </>
        )}

        {q && search.loading && (
          <div className="space-y-2 p-2" aria-label="Loading results">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-14" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {q && search.error && (
          <div className="px-3 py-8 text-center text-[13px] text-muted">
            Search is unavailable right now.{" "}
            <button type="button" className="font-medium text-text underline underline-offset-4" onClick={search.retry}>
              Retry
            </button>
          </div>
        )}

        {q &&
          !search.loading &&
          groups.map((g) => (
            <div key={g.type} className="mb-1.5" role="group" aria-label={GROUP_LABEL[g.type]}>
              <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
                <span className="eyebrow text-[10.5px]">{GROUP_LABEL[g.type]}</span>
                {g.total > g.items.length && <span className="text-[11px] text-faint">{g.total} results</span>}
              </div>
              {g.items.map(renderItem)}
            </div>
          ))}

        {q && search.newsLoading && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-faint">
            <span className="size-3 animate-spin rounded-full border border-faint border-t-transparent" /> Searching news…
          </div>
        )}

        {q && !search.loading && !search.error && flat.length === 0 && !search.newsLoading && (
          <div className="px-3 py-10 text-center">
            <p className="text-[13.5px] text-text">No results for “{q}”</p>
            <p className="mt-1 text-[12.5px] text-muted">Try a character, location, trailer or media type.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-divider px-4 py-2.5 text-[11.5px] text-faint">
        <div className="hidden items-center gap-3 sm:flex">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd> toggle
          </span>
        </div>
        {q ? (
          <button
            type="button"
            className="ml-auto font-medium text-muted hover:text-text"
            onClick={() => {
              pushRecent(q);
              onClose();
              router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            See all results →
          </button>
        ) : (
          <span className="ml-auto">News search powered by RockstarINTEL</span>
        )}
      </div>
    </Dialog>
  );
}
