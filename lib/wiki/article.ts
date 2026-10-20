import "server-only";
import { articleUrl, fetchArticle, isSafeFile, isViFile } from "./api";
import { classes, findAll, findFirst, hasClass, isEl, parseHtml, prune, textOf, type WElement, type WNode } from "./html";

/**
 * A wiki article reduced to what the site shows: GTA VI only. Articles about
 * GTA VI alone are shown whole; series-wide ones (a weapon or car that's in
 * every game) keep their intro, the parts about GTA VI and GTA VI images.
 */

export interface WikiImage {
  file: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface WikiInfobox {
  kind?: string;
  image?: WikiImage;
  caption?: WNode[];
  groups: { header?: string; rows: { label: string; value: WNode[] }[] }[];
}

export interface WikiSectionBlock {
  id: string;
  title: string;
  nodes: WNode[];
  subsections: { id: string; title: string; nodes: WNode[] }[];
}

export interface WikiArticle {
  title: string;
  url: string;
  /** Covers other games too, so only its GTA VI parts are shown. */
  series: boolean;
  lead: WNode[];
  infobox: WikiInfobox | null;
  sections: WikiSectionBlock[];
  /** The best GTA VI picture for the article. */
  image?: WikiImage;
  /** Plain-text summary (first paragraph), for descriptions. */
  summary: string;
}

/** Markup the site never shows: banners, edit links, navboxes, footnotes, hidden data. */
const JUNK = [
  "wiki-tophat", "wiki-tophat-flexible", "mw-editsection", "navbox", "toc", "mw-references-wrap", "references", "reflist", "noprint", "mw-empty-elt",
  "infobox-json", "wiki-chronology", "wiki-pagetabber", "printfooter", "catlinks", "hatnote", "dablink", "ambox", "messagebox", "mw-collapsible-toggle", "nomobile", "navigation-only", "mw-cite-backlink",
];
const isJunk = (e: WElement) =>
  e.tag === "sup" && hasClass(e, "reference") ? true : e.attrs.role === "navigation" || /display:\s*none/.test(e.attrs.style ?? "") || classes(e).some((c) => JUNK.includes(c) || c.startsWith("wiki-tophat"));

const DROP_SECTIONS = /^(navigation|references|notes|footnotes|external links|sources|see also)$/i;
const MENTIONS_VI = /\b(?:GTA ?VI|GTA ?6|Grand Theft Auto VI)\b/;
const GAME_HEADING = /Grand Theft Auto|\bGTA\b|Universe|Episodes from|Online|Liberty City|San Andreas|Chinatown|Vice City Stories|Red Dead/i;
const OTHER_GAME_TEXT = /\b(?:GTA ?(?:V(?!I)|IV|III|SA|VC|LCS|VCS|CW|Online|London|Advance|2)|Grand Theft Auto (?:V(?!I)|IV|III|Online|Advance|San Andreas|Vice City(?! \(GTA VI)|Liberty City|Chinatown))\b|\b(?:San Andreas|Los Santos|Liberty City|Alderney|Blaine County|Las Venturas|San Fierro|Carcer City|Anywhere City)\b/;
const OTHER_GAME_CATEGORY = /(?:^|_)(?:GTA|Grand_Theft_Auto)_(?:V(?!I)|IV|III|SA|VC|LCS|VCS|CW|Online|London|Advance|2)(?:\b|_|:|$)/;

/** File name from an <img> src ("/images/thumb/A-GTAVI.png/300px-A-GTAVI.png?x" → "A-GTAVI.png"). */
export function fileFromSrc(src: string): string | null {
  const path = src.split("?")[0];
  const m = path.match(/\/images\/thumb\/([^/]+)\/[^/]+$/) ?? path.match(/\/images\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

const imgOf = (e: WElement): WikiImage | null => {
  const img = e.tag === "img" ? e : findFirst(e.children, (x) => x.tag === "img");
  const file = img && fileFromSrc(img.attrs.src ?? "");
  if (!img || !file) return null;
  const width = Number(img.attrs["data-file-width"]) || undefined;
  const height = Number(img.attrs["data-file-height"]) || undefined;
  return { file, width, height };
};

/** Drops pictures that aren't allowed (another game's, or site chrome), with their frames. */
function filterImages(nodes: WNode[], allowed: (file: string) => boolean): WNode[] {
  const isPicture = (e: WElement) => e.tag === "figure" || e.attrs.typeof?.startsWith("mw:File") || hasClass(e, "gallerybox") || e.tag === "img";
  return prune(nodes, (e) => {
    if (!isPicture(e)) return false;
    const img = imgOf(e);
    return !img || !allowed(img.file);
  });
}

/** Lists and paragraphs boiled down to the bits that mention GTA VI. */
function onlyVi(nodes: WNode[]): WNode[] {
  const out: WNode[] = [];
  for (const n of nodes) {
    if (!isEl(n)) {
      if (n.text.trim() === "") out.push(n);
      continue;
    }
    if (n.tag === "ul" || n.tag === "ol") {
      const items = n.children.filter((li) => isEl(li) && li.tag === "li" && MENTIONS_VI.test(textOf(li)));
      if (items.length) out.push({ ...n, children: items });
    } else if (hasClass(n, "gallery") || findFirst([n], (e) => hasClass(e, "gallery"))) {
      out.push(n); // already filtered to GTA VI images
    } else if (MENTIONS_VI.test(textOf(n))) out.push(n);
  }
  return out;
}

const hasContent = (nodes: WNode[]): boolean => nodes.some((n) => (isEl(n) ? n.tag === "img" || hasContent(n.children) || textOf(n).trim() !== "" : n.text.trim() !== ""));

/** Heading level and title of a MediaWiki heading (wrapped in div.mw-heading, or bare). */
function heading(n: WNode): { level: number; title: string; id: string } | null {
  if (!isEl(n)) return null;
  const h = /^h[2-4]$/.test(n.tag) ? n : hasClass(n, "mw-heading") ? findFirst(n.children, (e) => /^h[2-4]$/.test(e.tag)) : undefined;
  if (!h) return null;
  return { level: Number(h.tag[1]), title: textOf(h).trim(), id: h.attrs.id ?? "" };
}

function infobox(root: WElement, series: boolean): WikiInfobox {
  const pick = (cls: string) => findFirst(root.children, (e) => hasClass(e, cls));
  const imageBox = pick("infobox-image");
  const image = imageBox ? imgOf(imageBox) : null;
  const groups = findAll(root.children, (e) => hasClass(e, "infobox-group")).map((g) => ({
    header: textOf(findFirst(g.children, (e) => hasClass(e, "infobox-header")) ?? []).trim() || undefined,
    rows: findAll(g.children, (e) => hasClass(e, "infobox-row-container")).map((r) => ({
      label: textOf(findFirst(r.children, (e) => hasClass(e, "infobox-row-label")) ?? []).trim(),
      value: findFirst(r.children, (e) => hasClass(e, "infobox-row-value"))?.children ?? [],
    })),
  }));
  const okImage = image && (series ? isViFile(image.file) : isSafeFile(image.file)) ? image : undefined;
  const kept = series
    ? // Only the general details; prices, spawns and such differ per game.
      groups.slice(0, 1).map((g) => ({ ...g, rows: g.rows.filter((r) => !/appears in|mentioned in|featured in/i.test(r.label) && !OTHER_GAME_TEXT.test(textOf(r.value))) }))
    : groups.map((g) => ({ ...g, rows: g.rows.filter((r) => !/appears in|mentioned in|featured in/i.test(r.label)) }));
  return {
    kind: textOf(pick("infobox-subtitle") ?? []).trim() || undefined,
    image: okImage,
    caption: okImage ? pick("infobox-image-caption")?.children : undefined,
    groups: kept.filter((g) => g.rows.length),
  };
}

export async function getWikiArticle(title: string): Promise<WikiArticle | null> {
  const parsed = await fetchArticle(title);
  if (!parsed) return null;
  const series = parsed.categories.some((c) => OTHER_GAME_CATEGORY.test(c.category));
  const allowed = series ? isViFile : isSafeFile;

  const tree = parseHtml(parsed.text);
  const body = findFirst(tree, (e) => hasClass(e, "mw-parser-output"))?.children ?? tree;
  const box = findFirst(body, (e) => hasClass(e, "infobox-root"));
  // Tabs for other games (tabbers keyed by game) go too.
  const otherGameTab = (e: WElement) => hasClass(e, "tabbertab") && GAME_HEADING.test(e.attrs["data-title"] ?? "") && !MENTIONS_VI.test(e.attrs["data-title"] ?? "");
  const flow = filterImages(
    prune(body, (e) => isJunk(e) || hasClass(e, "infobox-root") || otherGameTab(e)),
    allowed,
  );

  // Lead, then h2 sections with their h3 subsections (deeper headings stay inside).
  const lead: WNode[] = [];
  const sections: WikiSectionBlock[] = [];
  for (const n of flow) {
    const h = heading(n);
    const current = sections.at(-1);
    if (h?.level === 2) sections.push({ id: h.id, title: h.title, nodes: [], subsections: [] });
    else if (h?.level === 3 && current) current.subsections.push({ id: h.id, title: h.title, nodes: [] });
    else if (!current) lead.push(n);
    else if (current.subsections.length) current.subsections.at(-1)!.nodes.push(n);
    else current.nodes.push(n);
  }

  const kept = sections
    .filter((s) => !DROP_SECTIONS.test(s.title))
    .map((s) => {
      if (!series) return s;
      const subsections = s.subsections
        .filter((sub) => MENTIONS_VI.test(sub.title) || (!GAME_HEADING.test(sub.title) && MENTIONS_VI.test(textOf(sub.nodes))) || (!GAME_HEADING.test(sub.title) && findFirst(sub.nodes, (e) => hasClass(e, "gallery"))))
        .map((sub) => (MENTIONS_VI.test(sub.title) ? sub : { ...sub, nodes: onlyVi(sub.nodes) }));
      return { ...s, nodes: onlyVi(s.nodes), subsections };
    })
    .filter((s) => hasContent(s.nodes) || s.subsections.some((sub) => hasContent(sub.nodes)));

  const info = box ? infobox(box, series) : null;
  const firstPicture = findFirst([...lead, ...kept.flatMap((s) => [...s.nodes, ...s.subsections.flatMap((x) => x.nodes)])], (e) => e.tag === "img");
  const image = info?.image ?? (firstPicture ? (imgOf(firstPicture) ?? undefined) : undefined);
  const firstParagraph = lead.find((n) => isEl(n) && n.tag === "p" && textOf(n).trim().length > 40);

  return {
    title: parsed.title,
    url: articleUrl(parsed.title),
    series,
    // On series pages, quotes up top are usually from another game.
    lead: lead.filter((n) => !isEl(n) || ((n.tag !== "div" || hasContent([n])) && !(series && hasClass(n, "wiki-quote") && !MENTIONS_VI.test(textOf(n))))),
    infobox: info && (info.image || info.groups.length) ? info : null,
    sections: kept,
    image,
    summary: firstParagraph ? textOf(firstParagraph).replace(/\s+/g, " ").trim() : "",
  };
}
