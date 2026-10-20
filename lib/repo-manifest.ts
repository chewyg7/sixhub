import { z } from "zod";

/**
 * The repo file format and its checks, shared by the browser (which loads
 * repos) and the server (which only reads a shared repo's name and picture
 * to draw its link preview).
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
