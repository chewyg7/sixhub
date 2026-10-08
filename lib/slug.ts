/** URL-safe slug: "Lucia's Car (2)" → "lucias-car-2". */
export function slugify(input: string, max = 64): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "item"
  );
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First free slug: base, base-2, base-3 … */
export function uniqueSlug(base: string, taken: (s: string) => boolean): string {
  const root = slugify(base);
  if (!taken(root)) return root;
  for (let i = 2; i < 10_000; i++) {
    const s = `${root.slice(0, 58)}-${i}`;
    if (!taken(s)) return s;
  }
  return `${root.slice(0, 40)}-${Date.now().toString(36)}`;
}

/** "lucia_caminos-01.final.png" → "Lucia Caminos 01 Final". */
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 120);
}
