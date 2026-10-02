"use client";

import { useSyncExternalStore } from "react";

/**
 * Personal library: favorites, user collections and recently viewed media.
 *
 * State lives behind a `LibraryAdapter`. Today that is localStorage (no
 * account required). When accounts exist, implement the same interface
 * against an API and call `setLibraryAdapter()` after sign-in; components
 * don't change.
 */

export interface UserCollection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: string[];
}

export interface LibraryState {
  version: 1;
  favorites: { slug: string; addedAt: string }[];
  collections: UserCollection[];
  recent: { slug: string; viewedAt: string }[];
}

export interface LibraryAdapter {
  load(): LibraryState;
  save(state: LibraryState): void;
  /** Notify on external changes (e.g. another tab). */
  subscribe?(onChange: () => void): () => void;
}

const EMPTY: LibraryState = { version: 1, favorites: [], collections: [], recent: [] };
const KEY = "gh:library:v1";
const RECENT_LIMIT = 40;

function isState(v: unknown): v is LibraryState {
  return !!v && typeof v === "object" && (v as LibraryState).version === 1 && Array.isArray((v as LibraryState).favorites);
}

export const localStorageAdapter: LibraryAdapter = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return isState(parsed) ? { ...EMPTY, ...parsed } : EMPTY;
    } catch {
      return EMPTY;
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked (private mode). The in-memory state still works for this session.
    }
  },
  subscribe(onChange) {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) onChange();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */
let adapter: LibraryAdapter = localStorageAdapter;
let state: LibraryState | null = null;
const listeners = new Set<() => void>();
let unsubscribeAdapter: (() => void) | undefined;

function ensureLoaded(): LibraryState {
  if (state === null) {
    state = adapter.load();
    unsubscribeAdapter = adapter.subscribe?.(() => {
      state = adapter.load();
      listeners.forEach((l) => l());
    });
  }
  return state;
}

function commit(next: LibraryState) {
  state = next;
  adapter.save(next);
  listeners.forEach((l) => l());
}

export function setLibraryAdapter(next: LibraryAdapter) {
  unsubscribeAdapter?.();
  adapter = next;
  state = null;
  ensureLoaded();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => ensureLoaded();
const getServerSnapshot = () => EMPTY;

export function useLibrary<T>(selector: (s: LibraryState) => T): T {
  return selector(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));
}

/** True after hydration; lets UI avoid rendering "empty library" before localStorage is read. */
export function useLibraryReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

const now = () => new Date().toISOString();
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

export const library = {
  isFavorite(slug: string) {
    return ensureLoaded().favorites.some((f) => f.slug === slug);
  },
  toggleFavorite(slug: string): boolean {
    const s = ensureLoaded();
    const exists = s.favorites.some((f) => f.slug === slug);
    commit({ ...s, favorites: exists ? s.favorites.filter((f) => f.slug !== slug) : [{ slug, addedAt: now() }, ...s.favorites] });
    return !exists;
  },
  createCollection(name: string, initial: string[] = []): UserCollection {
    const s = ensureLoaded();
    const c: UserCollection = { id: uid(), name: name.trim() || "Untitled collection", createdAt: now(), updatedAt: now(), items: [...new Set(initial)] };
    commit({ ...s, collections: [c, ...s.collections] });
    return c;
  },
  renameCollection(id: string, name: string) {
    const s = ensureLoaded();
    commit({ ...s, collections: s.collections.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name, updatedAt: now() } : c)) });
  },
  deleteCollection(id: string) {
    const s = ensureLoaded();
    commit({ ...s, collections: s.collections.filter((c) => c.id !== id) });
  },
  restoreCollection(c: UserCollection) {
    const s = ensureLoaded();
    if (s.collections.some((x) => x.id === c.id)) return;
    commit({ ...s, collections: [c, ...s.collections] });
  },
  toggleInCollection(id: string, slug: string): boolean {
    const s = ensureLoaded();
    let added = false;
    commit({
      ...s,
      collections: s.collections.map((c) => {
        if (c.id !== id) return c;
        added = !c.items.includes(slug);
        return { ...c, items: added ? [...c.items, slug] : c.items.filter((x) => x !== slug), updatedAt: now() };
      }),
    });
    return added;
  },
  recordView(slug: string) {
    const s = ensureLoaded();
    if (s.recent[0]?.slug === slug) return;
    commit({ ...s, recent: [{ slug, viewedAt: now() }, ...s.recent.filter((r) => r.slug !== slug)].slice(0, RECENT_LIMIT) });
  },
  clearRecent() {
    commit({ ...ensureLoaded(), recent: [] });
  },
};
