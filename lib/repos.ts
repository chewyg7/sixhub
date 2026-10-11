"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { MediaItem } from "@/types/content";

/**
 * Repositories: JSON files, hosted anywhere by anyone, that list media by
 * link. Nothing goes through or onto our server. The browser fetches the
 * JSON and the media straight from wherever the repo points, and the list
 * of added repos lives only in this browser's storage.
 */

export type RepoKind = "image" | "video" | "audio";

export interface RepoItem {
  id: string;
  title: string;
  kind: RepoKind;
  url: string;
  thumbnail?: string;
  description?: string;
  folder?: string;
  credit?: string;
  width?: number;
  height?: number;
}

export interface RepoManifest {
  name: string;
  author: string;
  description: string;
  icon?: string;
  website?: string;
  items: RepoItem[];
  /** Entries that were left out because they were broken or unsupported. */
  skipped: number;
}

export interface SavedRepo {
  id: string;
  /** The repo's JSON file. */
  url: string;
  name: string;
  author: string;
  description: string;
  icon?: string;
  count: number;
  addedAt: number;
  updatedAt: number;
  /** Added from a share link: viewable even while repos are turned off in Settings. */
  viaShare: boolean;
}

export const REPO_LIMITS = { bytes: 5 * 1024 * 1024, items: 5000, timeoutMs: 15_000 } as const;

const EXT: Record<string, RepoKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
  avif: "image",
  svg: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
};

/** Resolves a link from a repo (relative links are relative to the JSON file). Only https, or http on localhost for testing. */
export function safeUrl(raw: unknown, base: string): string | undefined {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2048) return undefined;
  try {
    const u = new URL(raw.trim(), base);
    if (u.protocol === "https:") return u.href;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.href;
  } catch {}
  return undefined;
}

const text = (max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : ""));
const dim = z.unknown().transform((v) => (typeof v === "number" && v > 0 && v < 100_000 ? Math.round(v) : undefined));

const ManifestShape = z.object({
  name: text(60),
  author: text(60),
  description: text(600),
  icon: z.unknown().optional(),
  website: z.unknown().optional(),
  items: z.array(z.unknown()).max(REPO_LIMITS.items, `A repo can list up to ${REPO_LIMITS.items.toLocaleString("en-US")} items.`),
});

const ItemShape = z.object({
  title: text(160),
  url: z.unknown(),
  type: z.unknown().optional(),
  thumbnail: z.unknown().optional(),
  description: text(1000).optional(),
  folder: text(80).optional(),
  credit: text(120).optional(),
  width: dim.optional(),
  height: dim.optional(),
});

/** Checks a repo file and keeps only what's safe to show. Throws with a readable message. */
export function parseManifest(json: unknown, base: string): RepoManifest {
  const top = ManifestShape.safeParse(json);
  if (!top.success) throw new Error(top.error.issues[0]?.message.startsWith("A repo") ? top.error.issues[0].message : "That file isn't a repo. It needs at least a “name” and an “items” list.");
  if (!top.data.name) throw new Error("The repo has no “name”.");
  let skipped = 0;
  const items: RepoItem[] = [];
  top.data.items.forEach((raw, i) => {
    const r = ItemShape.safeParse(raw);
    const url = r.success ? safeUrl(r.data.url, base) : undefined;
    if (!r.success || !url) return void skipped++;
    const declared = typeof r.data.type === "string" ? r.data.type.toLowerCase() : "";
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
    const kind = (["image", "video", "audio"].includes(declared) ? declared : EXT[ext]) as RepoKind | undefined;
    if (!kind) return void skipped++;
    items.push({
      id: String(i),
      title: r.data.title || decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") || `Item ${i + 1}`,
      kind,
      url,
      thumbnail: safeUrl(r.data.thumbnail, base),
      description: r.data.description || undefined,
      folder: r.data.folder || undefined,
      credit: r.data.credit || undefined,
      width: r.data.width,
      height: r.data.height,
    });
  });
  return {
    name: top.data.name,
    author: top.data.author || "Unknown",
    description: top.data.description,
    icon: safeUrl(top.data.icon, base),
    website: safeUrl(top.data.website, base),
    items,
    skipped,
  };
}

const memo = new Map<string, Promise<RepoManifest>>();

/** Fetches and checks a repo straight from its host (never via our server). Cached for this visit. */
export function fetchRepo(url: string, fresh = false): Promise<RepoManifest> {
  if (!fresh && memo.has(url)) return memo.get(url)!;
  const run = (async () => {
    const safe = /^https?:\/\//i.test(url.trim()) ? safeUrl(url, "https://invalid.invalid/") : undefined;
    if (!safe) throw new Error("Repo links must start with https://");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REPO_LIMITS.timeoutMs);
    let res: Response;
    try {
      res = await fetch(safe, { credentials: "omit", referrerPolicy: "no-referrer", cache: fresh ? "no-cache" : "default", signal: ctl.signal });
    } catch (e) {
      throw new Error(
        (e as Error).name === "AbortError"
          ? "The repo's host took too long to answer."
          : "Couldn't load that link. The host may be down, or it doesn't let other websites read the file (CORS). GitHub raw links and Gists work.",
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`The repo's host answered ${res.status}. Check the link.`);
    if (Number(res.headers.get("content-length") ?? 0) > REPO_LIMITS.bytes) throw new Error("That repo file is larger than 5 MB.");
    const body = await res.text();
    if (body.length > REPO_LIMITS.bytes) throw new Error("That repo file is larger than 5 MB.");
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error("That link isn't a JSON file.");
    }
    return parseManifest(json, res.url || safe);
  })();
  memo.set(url, run);
  run.catch(() => memo.delete(url));
  return run;
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

/**
 * A repo item in the shape the site's lightbox, players and grid use. Every
 * URL is the repo's own link: nothing is copied to or served by our server.
 */
export function toMediaItem(repo: { id: string; name: string; website?: string }, item: RepoItem): MediaItem {
  const path = new URL(item.url).pathname;
  const filename = decodeURIComponent(path.split("/").pop() || "file");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const thumb = item.thumbnail ? { url: item.thumbnail, width: 640, height: 360, format: "webp" as const } : undefined;
  return {
    id: `repo-${repo.id}-${item.id}`,
    slug: `repo-${repo.id}-${item.id}`,
    title: item.title,
    kind: item.kind,
    category: "repo",
    description: item.description ?? "",
    alt: item.title,
    datePublished: "",
    dateAdded: "",
    source: { slug: "repo", label: repo.name, origin: "other", url: repo.website },
    width: item.width,
    height: item.height,
    original: { url: item.url, mimeType: MIME[ext] ?? `${item.kind}/*`, filename, width: item.width, height: item.height },
    // Images without a thumbnail use the file itself for previews.
    variants: thumb ? [thumb] : item.kind === "image" ? [{ url: item.url, width: item.width ?? 1600, height: item.height ?? 900, format: "webp" }] : [],
    poster: thumb && item.kind !== "image" ? { url: thumb.url, mimeType: "image/*", filename: "thumbnail" } : undefined,
    tags: [],
    characters: [],
    locations: [],
    collections: [],
    downloadable: true,
    credit: item.credit,
    verification: "community",
    external: { repoId: repo.id, repoName: repo.name, host: new URL(item.url).host },
  };
}

/** A short, stable id for a repo link. */
export function repoId(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + url.length.toString(36);
}

export const shareLink = (url: string) => `${location.origin}/media/repos/add?url=${encodeURIComponent(url)}`;

/* ---------- This browser's list of repos ---------- */

const KEY = "gh:repos";
let cache: SavedRepo[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: SavedRepo[] = [];

function read(): SavedRepo[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(v) ? v.filter((r) => r && typeof r.id === "string" && typeof r.url === "string") : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: SavedRepo[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

export function useSavedRepos(): SavedRepo[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => {
        if (e.key !== KEY) return;
        cache = null;
        l();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => EMPTY,
  );
}

/** Adds (or refreshes) a repo in this browser's list. */
export function saveRepo(url: string, m: RepoManifest, viaShare: boolean): SavedRepo {
  const list = read();
  const id = repoId(url);
  const old = list.find((r) => r.id === id);
  const repo: SavedRepo = {
    id,
    url,
    name: m.name,
    author: m.author,
    description: m.description,
    icon: m.icon,
    count: m.items.length,
    addedAt: old?.addedAt ?? Date.now(),
    updatedAt: Date.now(),
    viaShare: old ? old.viaShare || viaShare : viaShare,
  };
  write(old ? list.map((r) => (r.id === id ? repo : r)) : [repo, ...list]);
  return repo;
}

export function removeRepo(id: string) {
  write(read().filter((r) => r.id !== id));
}
