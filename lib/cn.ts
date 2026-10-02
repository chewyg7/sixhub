type ClassValue = string | number | false | null | undefined | Record<string, boolean | undefined>;

const DISPLAY = new Set(["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "contents", "table"]);

/**
 * Minimal className combiner (no dependency needed for this).
 *
 * Resolves the one conflict this codebase relies on: components have a base
 * display (e.g. `inline-flex`) and callers hide them responsively with
 * `hidden md:inline-flex`. Utilities of equal specificity are ordered by the
 * stylesheet, not the class list, so an unprefixed `hidden` removes other
 * unprefixed display utilities here.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (typeof v === "string" || typeof v === "number") out.push(...String(v).split(/\s+/).filter(Boolean));
    else for (const [k, on] of Object.entries(v)) if (on) out.push(k);
  }
  if (out.includes("hidden")) return out.filter((c) => !DISPLAY.has(c)).join(" ");
  return out.join(" ");
}
