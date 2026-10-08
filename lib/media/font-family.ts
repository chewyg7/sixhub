/**
 * Splits a font's full name into its family and style, e.g.
 * "GTA Art Deco Condensed Bold" → { family: "GTA Art Deco", style: "Condensed Bold" }.
 * Many fonts name each weight as its own family, so the style words are
 * peeled off the end of the name.
 */
const STYLE_WORD =
  /^(thin|hairline|extralight|extra-light|ultralight|ultra-light|light|book|regular|normal|roman|plain|medium|semibold|semi-bold|demibold|demi-bold|bold|extrabold|extra-bold|ultrabold|ultra-bold|heavy|black|ultra|extra|semi|demi|condensed|cond|compressed|narrow|extended|expanded|wide|italic|oblique|slanted|display|text|[1-9]00)$/i;

export function splitFontName(name: string): { family: string; style: string } {
  const words = name.replace(/[-_]+/g, " ").trim().split(/\s+/);
  let i = words.length;
  while (i > 1 && STYLE_WORD.test(words[i - 1])) i--;
  const family = words.slice(0, i).join(" ");
  const style = words.slice(i).join(" ");
  return { family: family || name, style: style || "Regular" };
}

/** Rough CSS weight for a style name, used to order a family's styles. */
export function styleWeight(style: string): number {
  const s = style.toLowerCase().replace(/[\s-]/g, "");
  const w = /thin|hairline/.test(s)
    ? 100
    : /(extra|ultra)light/.test(s)
      ? 200
      : /light/.test(s)
        ? 300
        : /medium/.test(s)
          ? 500
          : /(semi|demi)bold/.test(s)
            ? 600
            : /(extra|ultra)bold/.test(s)
              ? 800
              : /black|heavy/.test(s)
                ? 900
                : /bold/.test(s)
                  ? 700
                  : 400;
  // Widths and italics sort after the upright, normal-width styles of the same weight.
  return w + (/condensed|compressed|narrow/.test(s) ? 1000 : 0) + (/extended|expanded|wide/.test(s) ? 2000 : 0) + (/italic|oblique/.test(s) ? 5 : 0);
}
