import "server-only";
import { cache } from "react";

/**
 * GTA Wiki (gta.wiki) integration: the Information database reads its GTA VI
 * categories and articles through the wiki's public MediaWiki API. Responses
 * are cached for a day (tag "wiki"), so the wiki sees a handful of requests
 * per page per day, however busy the site is. Images are loaded straight from
 * the wiki's own image server.
 *
 * Wiki text is CC BY-NC-SA 3.0: every page that shows it credits the wiki and
 * links to the original article (see WikiCredit).
 */

export const WIKI_ORIGIN = "https://gta.wiki";
export const WIKI_LICENSE = { name: "CC BY-NC-SA 3.0", url: "https://creativecommons.org/licenses/by-nc-sa/3.0/" };
const API = `${WIKI_ORIGIN}/api.php`;
const UA = "GTA6Hub/1.0 (+https://gtasixhub.com; Information database)";
const DAY = 86400;

export interface WikiSection {
  slug: string;
  title: string;
  description: string;
  /** Singular, for counts ("88 characters"). */
  noun: string;
  plural: string;
  /** GTA VI categories the section lists (sub-categories included when `deep`). */
  categories: string[];
  deep?: boolean;
  /** Card shape: portraits for people, landscape for everything else. */
  shape: "portrait" | "landscape";
}

/** The Information sections the wiki fills, GTA VI only. */
export const WIKI_SECTIONS: WikiSection[] = [
  { slug: "characters", title: "Characters", description: "Jason, Lucia and everyone around them in Leonida.", noun: "character", plural: "characters", categories: ["Characters in GTA VI"], shape: "portrait" },
  { slug: "locations", title: "Locations", description: "Counties, cities, neighbourhoods and the wilds of Leonida.", noun: "location", plural: "locations", categories: ["Locations in GTA VI"], deep: true, shape: "landscape" },
  { slug: "landmarks", title: "Landmarks", description: "Buildings and structures across the state.", noun: "landmark", plural: "landmarks", categories: ["Buildings in GTA VI", "Structures in GTA VI"], deep: true, shape: "landscape" },
  { slug: "vehicles", title: "Vehicles", description: "Cars, bikes, boats and aircraft confirmed for GTA VI.", noun: "vehicle", plural: "vehicles", categories: ["Vehicles in GTA VI"], shape: "landscape" },
  { slug: "weapons", title: "Weapons", description: "Guns, melee weapons and throwables.", noun: "weapon", plural: "weapons", categories: ["Weapons in GTA VI"], shape: "landscape" },
  { slug: "businesses", title: "Businesses", description: "Brands, shops, venues and companies in Leonida.", noun: "business", plural: "businesses", categories: ["Businesses in GTA VI"], shape: "landscape" },
  { slug: "organizations", title: "Organizations", description: "Gangs, police departments, teams and agencies.", noun: "organization", plural: "organizations", categories: ["Organizations in GTA VI"], shape: "landscape" },
  { slug: "radio-and-media", title: "Radio & Media", description: "Radio stations, songs, shows and in-game media.", noun: "entry", plural: "entries", categories: ["Media in GTA VI"], shape: "landscape" },
  { slug: "gameplay", title: "Gameplay", description: "Systems and features confirmed for GTA VI.", noun: "feature", plural: "features", categories: ["Gameplay in GTA VI"], shape: "landscape" },
  { slug: "items", title: "Items", description: "Consumables, gadgets and pickups.", noun: "item", plural: "items", categories: ["Items in GTA VI"], shape: "landscape" },
  { slug: "animals", title: "Animals", description: "The wildlife and pets of Leonida.", noun: "animal", plural: "animals", categories: ["Animals in GTA VI"], shape: "landscape" },
];

export const wikiSection = (slug: string) => WIKI_SECTIONS.find((s) => s.slug === slug);

/** URL slug for a wiki title ("Dre'Quan Priest" → "drequan-priest"). */
export function wikiSlug(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A title without the wiki's disambiguation tag ("Billy (GTA VI)" → "Billy"). */
export const displayName = (title: string) => title.replace(/s*((?:GTA VI|HD Universe|character|GTA 6))$/i, "");

export const articleUrl = (title: string) => `${WIKI_ORIGIN}/w/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}`;

/* ---------- Images ---------- */

/** Files made for GTA VI ("Jason-GTAVI-Trailer1.png", "Logo-GTA6.png"). */
const VI_FILE = /GTA[ _-]?(?:VI|6)(?![a-z0-9])/;
/** Files from other games ("…-GTAV.png", "…-GTASA.jpg", "…-GTAO-…"). */
const OTHER_FILE = /GTA[ _-]?(?:V(?!I)|IV|III|SA|VC|LCS|VCS|CW|O(?![a-z])|Online|London|A(?![a-z])|2(?![0-9]))|EFLC|TLaD|TBoGT|RDR/;
/** Site chrome that shows up in page markup. */
const CHROME_FILE = /^(Site-logo|Wiki|Wikipedia-logo|Flag-|Logo-GTAVI|Unknown|Placeholder|No[-_ ]?image)/i;

export const isViFile = (file: string) => VI_FILE.test(file) && !CHROME_FILE.test(file);
/** For GTA VI-only articles, anything that isn't plainly from another game (or site chrome). */
export const isSafeFile = (file: string) => !CHROME_FILE.test(file) && (VI_FILE.test(file) || !OTHER_FILE.test(file));

/** A wiki image at (about) `width` pixels wide, from the wiki's image server. */
export function imageUrl(file: string, width?: number, fileWidth?: number) {
  const name = file.replace(/ /g, "_");
  const enc = encodeURIComponent(name);
  if (!width || (fileWidth && width >= fileWidth) || /\.(gif|svg)$/i.test(name)) return `${WIKI_ORIGIN}/images/${enc}`;
  return `${WIKI_ORIGIN}/images/thumb/${enc}/${width}px-${enc}`;
}

/* ---------- API ---------- */

type Params = Record<string, string | number>;

async function api<T>(params: Params): Promise<T | null> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: 2, ...params })) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000), next: { revalidate: DAY, tags: ["wiki"] } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

interface Continued<Q> {
  query?: Q;
  continue?: Record<string, string>;
}

async function all<Q>(params: Params, take: (q: Q) => void, maxPages = 20) {
  let cont: Record<string, string> | undefined = {};
  for (let i = 0; cont && i < maxPages; i++) {
    const r: Continued<Q> | null = await api<Continued<Q>>({ ...params, ...cont });
    if (!r?.query) break;
    take(r.query);
    cont = r.continue;
  }
}

export interface WikiMember {
  title: string;
  slug: string;
  /** Card picture (a GTA VI file), when the wiki has one. */
  image?: string;
}

interface MemberQuery {
  pages?: { title: string; ns: number; pageimage?: string }[];
}

/** Pages directly in a category, with their page image. */
async function categoryPages(category: string) {
  const pages = new Map<string, string | undefined>();
  await all<MemberQuery>(
    { action: "query", generator: "categorymembers", gcmtitle: `Category:${category}`, gcmnamespace: 0, gcmlimit: 50, prop: "pageimages", piprop: "name", pilimit: 50 },
    (q) => q.pages?.forEach((p) => pages.set(p.title, p.pageimage ?? pages.get(p.title))),
  );
  return pages;
}

async function subcategories(category: string): Promise<string[]> {
  const out: string[] = [];
  await all<{ categorymembers?: { title: string }[] }>(
    { action: "query", list: "categorymembers", cmtitle: `Category:${category}`, cmtype: "subcat", cmlimit: 200 },
    (q) => q.categorymembers?.forEach((c) => out.push(c.title.replace(/^Category:/, ""))),
  );
  return out.filter((c) => /GTA VI/.test(c));
}

/**
 * GTA VI files by the page they show ("BaseballBat-GTAVI-…" → "baseballbat"),
 * for pages whose own page image is from another game.
 */
const viFilesByPrefix = cache(async () => {
  const map = new Map<string, string>();
  await all<{ categorymembers?: { title: string }[] }>(
    { action: "query", list: "categorymembers", cmtitle: "Category:Images of GTA VI", cmtype: "file", cmlimit: 500 },
    (q) =>
      q.categorymembers?.forEach(({ title }) => {
        const file = title.replace(/^File:/, "");
        const prefix = file.split(/-GTA[ _-]?(?:VI|6)/)[0];
        if (prefix === file || !isViFile(file)) return;
        const key = prefix.toLowerCase().replace(/[^a-z0-9]/g, "");
        const prev = map.get(key);
        // Prefer portraits and front-quarter views as the card picture.
        if (!prev || (/Portrait|FrontQuarter|Official/i.test(file) && !/Portrait|FrontQuarter/i.test(prev))) map.set(key, file);
      }),
  );
  return map;
});

/** Everything in a section, A–Z, each with a GTA VI picture where there is one. */
export const sectionMembers = cache(async (slug: string): Promise<WikiMember[]> => {
  const section = wikiSection(slug);
  if (!section) return [];
  const cats = [...section.categories];
  if (section.deep) for (const c of section.categories) cats.push(...(await subcategories(c)));
  const [lists, viFiles] = await Promise.all([Promise.all(cats.map(categoryPages)), viFilesByPrefix()]);
  const merged = new Map<string, string | undefined>();
  for (const list of lists) for (const [t, img] of list) if (!merged.has(t) || (!merged.get(t) && img)) merged.set(t, img);
  return [...merged]
    .filter(([t]) => !/\((?:disambiguation)\)$/.test(t))
    .map(([title, img]) => {
      const fallback = viFiles.get(title.replace(/\s*\(.*\)$/, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
      return { title, slug: wikiSlug(title), image: img && isViFile(img) ? img : (fallback ?? (img && isSafeFile(img) && section.slug === "characters" ? img : undefined)) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
});

/** Every GTA VI article the site has a page for, by wiki title (for linking between articles). */
export const wikiIndex = cache(async () => {
  const byTitle = new Map<string, { section: string; slug: string }>();
  for (const s of WIKI_SECTIONS) for (const m of await sectionMembers(s.slug)) if (!byTitle.has(m.title)) byTitle.set(m.title, { section: s.slug, slug: m.slug });
  return byTitle;
});

export async function memberBySlug(section: string, slug: string) {
  return (await sectionMembers(section)).find((m) => m.slug === slug) ?? null;
}

export interface WikiParse {
  title: string;
  displaytitle?: string;
  text: string;
  categories: { category: string; hidden?: boolean }[];
  revid?: number;
}

/** A rendered article (HTML) and its categories. */
export const fetchArticle = cache(async (title: string): Promise<WikiParse | null> => {
  const r = await api<{ parse?: WikiParse }>({ action: "parse", page: title, prop: "text|categories|displaytitle|revid", redirects: 1, disableeditsection: 1, disabletoc: 1, disablelimitreport: 1 });
  return r?.parse ?? null;
});
