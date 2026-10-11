/** URL builders shared across the site so link formats stay consistent. */

import type { MediaItem } from "@/types/content";

export function viewerHref(slug: string, opts: { t?: number; compare?: string } = {}) {
  const p = new URLSearchParams({ m: slug });
  if (opts.t) p.set("t", opts.t.toFixed(3));
  if (opts.compare) p.set("b", opts.compare);
  return `/viewer?${p.toString()}`;
}

export function mediaHref(slug: string) {
  return `/media/${slug}`;
}

/**
 * Media Viewer link for any item. Repo items open by their own URL (the
 * viewer fetches it directly), with the title and kind carried along.
 */
export function viewerHrefFor(item: MediaItem, opts: { t?: number } = {}) {
  if (!item.external) return viewerHref(item.slug, opts);
  const p = new URLSearchParams({ src: item.original.url, n: item.title, k: item.kind });
  if (opts.t) p.set("t", opts.t.toFixed(3));
  return `/viewer?${p.toString()}`;
}
