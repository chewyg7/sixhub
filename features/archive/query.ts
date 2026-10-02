/**
 * Archive query model: parsing/serializing URL state, filtering, faceting
 * and sorting. Pure functions so the same logic can move server-side (or
 * into SQL) when the archive outgrows client-side filtering.
 */
import type { MediaCategorySlug, MediaItem, MediaKind } from "@/types/content";
import { normalize } from "@/features/search/engine";
import { orientationOf, resolutionTier, type Orientation, type ResolutionTier } from "@/lib/format";

export type SortKey = "newest" | "oldest" | "added" | "name" | "resolution";
export type ViewMode = "grid" | "compact" | "list";

export interface ArchiveQuery {
  q: string;
  category: MediaCategorySlug[];
  type: MediaKind[];
  character: string[];
  location: string[];
  source: string[];
  resolution: ResolutionTier[];
  orientation: Orientation[];
  tag: string[];
  from: string;
  to: string;
  sort: SortKey;
  view: ViewMode;
}

export type FacetKey = "category" | "type" | "character" | "location" | "source" | "resolution" | "orientation" | "tag";
export const FACET_KEYS: FacetKey[] = ["category", "type", "character", "location", "source", "resolution", "orientation", "tag"];

export const EMPTY_QUERY: ArchiveQuery = {
  q: "",
  category: [],
  type: [],
  character: [],
  location: [],
  source: [],
  resolution: [],
  orientation: [],
  tag: [],
  from: "",
  to: "",
  sort: "newest",
  view: "grid",
};

const SORTS: SortKey[] = ["newest", "oldest", "added", "name", "resolution"];
const VIEWS: ViewMode[] = ["grid", "compact", "list"];

export function parseQuery(sp: URLSearchParams, base: Partial<ArchiveQuery> = {}): ArchiveQuery {
  const list = <T extends string>(k: string) =>
    sp
      .getAll(k)
      .flatMap((v) => v.split(","))
      .filter(Boolean) as T[];
  const sort = sp.get("sort") as SortKey;
  const view = sp.get("view") as ViewMode;
  return {
    ...EMPTY_QUERY,
    ...base,
    q: sp.get("q") ?? "",
    category: base.category ?? list("category"),
    type: list("type"),
    character: list("character"),
    location: list("location"),
    source: list("source"),
    resolution: list("resolution"),
    orientation: list("orientation"),
    tag: list("tag"),
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    sort: SORTS.includes(sort) ? sort : "newest",
    view: VIEWS.includes(view) ? view : "grid",
  };
}

export function serializeQuery(q: ArchiveQuery, lockedCategory?: boolean): URLSearchParams {
  const sp = new URLSearchParams();
  if (q.q) sp.set("q", q.q);
  for (const k of FACET_KEYS) {
    if (k === "category" && lockedCategory) continue;
    const v = q[k] as string[];
    if (v.length) sp.set(k, v.join(","));
  }
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  if (q.sort !== "newest") sp.set("sort", q.sort);
  if (q.view !== "grid") sp.set("view", q.view);
  return sp;
}

/* ------------------------------------------------------------------ */
/* Indexing                                                            */
/* ------------------------------------------------------------------ */
export interface IndexedMedia {
  item: MediaItem;
  hay: string;
  tier: ResolutionTier | null;
  orientation: Orientation | null;
  pixels: number;
}

export function indexMedia(items: MediaItem[], labels: { characters: Record<string, string>; locations: Record<string, string> }): IndexedMedia[] {
  return items.map((item) => ({
    item,
    hay: normalize(
      [
        item.title,
        item.description,
        item.alt,
        item.category,
        item.kind,
        item.source.label,
        ...item.tags,
        ...item.characters.map((c) => labels.characters[c] ?? c),
        ...item.locations.map((l) => labels.locations[l] ?? l),
        item.original.filename,
      ].join(" "),
    ),
    tier: resolutionTier(item.width, item.height),
    orientation: orientationOf(item.width, item.height),
    pixels: (item.width ?? 0) * (item.height ?? 0),
  }));
}

function facetValues(m: IndexedMedia, key: FacetKey): string[] {
  switch (key) {
    case "category":
      return [m.item.category];
    case "type":
      return [m.item.kind];
    case "character":
      return m.item.characters;
    case "location":
      return m.item.locations;
    case "source":
      return [m.item.source.slug];
    case "resolution":
      return m.tier ? [m.tier] : [];
    case "orientation":
      return m.orientation ? [m.orientation] : [];
    case "tag":
      return m.item.tags;
  }
}

function matches(m: IndexedMedia, q: ArchiveQuery, tokens: string[], skip?: FacetKey): boolean {
  for (const t of tokens) if (!m.hay.includes(t)) return false;
  for (const k of FACET_KEYS) {
    if (k === skip) continue;
    const selected = q[k] as string[];
    if (!selected.length) continue;
    const values = facetValues(m, k);
    // OR within a facet (tags use AND: narrowing by several tags means "all of them").
    if (k === "tag" ? !selected.every((s) => values.includes(s)) : !selected.some((s) => values.includes(s))) return false;
  }
  if (q.from && m.item.datePublished < q.from) return false;
  if (q.to && m.item.datePublished > q.to) return false;
  return true;
}

export function runQuery(index: IndexedMedia[], q: ArchiveQuery): MediaItem[] {
  const tokens = normalize(q.q).split(" ").filter(Boolean);
  const out = index.filter((m) => matches(m, q, tokens));
  const cmp: Record<SortKey, (a: IndexedMedia, b: IndexedMedia) => number> = {
    newest: (a, b) => b.item.datePublished.localeCompare(a.item.datePublished) || b.item.dateAdded.localeCompare(a.item.dateAdded),
    oldest: (a, b) => a.item.datePublished.localeCompare(b.item.datePublished) || a.item.title.localeCompare(b.item.title),
    added: (a, b) => b.item.dateAdded.localeCompare(a.item.dateAdded),
    name: (a, b) => a.item.title.localeCompare(b.item.title, "en", { numeric: true }),
    resolution: (a, b) => b.pixels - a.pixels || a.item.title.localeCompare(b.item.title),
  };
  return out.sort(cmp[q.sort]).map((m) => m.item);
}

/** Counts per facet value, computed with every other active filter applied. */
export function facetCounts(index: IndexedMedia[], q: ArchiveQuery): Record<FacetKey, Map<string, number>> {
  const tokens = normalize(q.q).split(" ").filter(Boolean);
  const result = {} as Record<FacetKey, Map<string, number>>;
  for (const k of FACET_KEYS) {
    const counts = new Map<string, number>();
    for (const m of index) {
      if (!matches(m, q, tokens, k)) continue;
      for (const v of facetValues(m, k)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    result[k] = counts;
  }
  return result;
}

export function activeFilterCount(q: ArchiveQuery, lockedCategory?: boolean): number {
  return FACET_KEYS.reduce((n, k) => n + (k === "category" && lockedCategory ? 0 : (q[k] as string[]).length), 0) + (q.from ? 1 : 0) + (q.to ? 1 : 0);
}
