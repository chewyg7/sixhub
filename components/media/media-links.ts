/** URL builders shared across the site so link formats stay consistent. */

export function viewerHref(slug: string, opts: { t?: number; compare?: string } = {}) {
  const p = new URLSearchParams({ m: slug });
  if (opts.t) p.set("t", opts.t.toFixed(3));
  if (opts.compare) p.set("b", opts.compare);
  return `/viewer?${p.toString()}`;
}

export function mediaHref(slug: string) {
  return `/media/${slug}`;
}
