import type { MediaItem } from "@/types/content";
import type { LabelLookups } from "@/lib/content/relations";
import { largestVariant, smallestVariant } from "@/lib/media/variants";
import { formatResolution, resolutionTier } from "@/lib/format";
import { SITE } from "@/lib/site";

/**
 * Search-engine helpers: richer titles and descriptions for media pages, and
 * schema.org structured data so Google (and Google Images) understands what
 * each page shows.
 */

export const absolute = (url: string) => (url.startsWith("http") ? url : `${SITE.url}${url.startsWith("/") ? "" : "/"}${url}`);

const mentionsGame = (s: string) => /\b(gta|grand theft auto)\b/i.test(s);

/** People search "GTA 6 screenshot", so titles say it when the item's name doesn't. */
export function mediaSeoTitle(item: MediaItem, singular: string): string {
  return mentionsGame(item.title) ? item.title : `${item.title} – GTA 6 ${singular}`;
}

function names(item: MediaItem, labels: LabelLookups) {
  return {
    characters: item.characters.map((c) => labels.characters[c] ?? c),
    locations: item.locations.map((l) => labels.locations[l] ?? l),
  };
}

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** A description that reads naturally and carries what people search for (characters, places, quality). */
export function mediaSeoDescription(item: MediaItem, singular: string, labels: LabelLookups): string {
  const { characters, locations } = names(item, labels);
  const official = item.verification === "official" ? "Official " : "";
  const tier = resolutionTier(item.width, item.height);
  const parts = [
    `${official}GTA 6 ${singular.toLowerCase()}${item.source.label ? ` from ${item.source.label}` : ""}${tier ? ` in ${tier}` : ""}.`,
    characters.length ? `Featuring ${list(characters.slice(0, 3))}${locations.length ? ` in ${list(locations.slice(0, 2))}` : ""}.` : locations.length ? `Set in ${list(locations.slice(0, 2))}.` : "",
    item.downloadable ? "View and download in full resolution." : "View in full resolution.",
  ];
  const auto = parts.filter(Boolean).join(" ");
  // Keep a hand-written description first when there is one.
  const own = item.description.trim();
  const generic = !own || own.length < 90 || own.startsWith(`${item.title}.`);
  const text = generic ? `${item.title}: ${auto}` : `${own} ${auto}`;
  return text.length > 300 ? `${text.slice(0, 297).trimEnd()}…` : text;
}

/** Search keywords: the game, the item's characters, places and tags. */
export function mediaKeywords(item: MediaItem, singular: string, labels: LabelLookups): string[] {
  const { characters, locations } = names(item, labels);
  return [...new Set(["GTA 6", "GTA VI", "Grand Theft Auto VI", `GTA 6 ${singular.toLowerCase()}`, ...characters, ...locations, ...item.tags, item.source.label].filter(Boolean))];
}

const isoDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `PT${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}H` : ""}${Math.floor((s % 3600) / 60) ? `${Math.floor((s % 3600) / 60)}M` : ""}${s % 60}S`;
};

/** The picture search engines should show for an item (largest web-friendly image). */
export function mediaImage(item: MediaItem) {
  if (item.kind === "image") {
    const v = largestVariant(item);
    return v ? { url: absolute(v.url), width: v.width, height: v.height } : { url: absolute(item.original.url), width: item.width, height: item.height };
  }
  const v = largestVariant(item) ?? (item.poster ? { url: item.poster.url, width: item.poster.width, height: item.poster.height } : undefined);
  return v ? { url: absolute(v.url), width: v.width, height: v.height } : undefined;
}

/** schema.org data for a media page: the image / video / audio itself plus its breadcrumb trail. */
export function mediaJsonLd(item: MediaItem, opts: { singular: string; labels: LabelLookups; crumbs: { name: string; href: string }[] }) {
  const page = absolute(`/media/${item.slug}`);
  const image = mediaImage(item);
  const thumb = smallestVariant(item, 480);
  const keywords = mediaKeywords(item, opts.singular, opts.labels).join(", ");
  const description = mediaSeoDescription(item, opts.singular, opts.labels);
  const credit = item.credit || (item.verification === "official" ? "Rockstar Games" : undefined);
  const common = {
    "@id": `${page}#media`,
    name: item.title,
    description,
    url: page,
    keywords,
    datePublished: item.datePublished || undefined,
    uploadDate: item.datePublished || undefined,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    about: { "@type": "VideoGame", name: "Grand Theft Auto VI", alternateName: ["GTA 6", "GTA VI"], publisher: { "@type": "Organization", name: "Rockstar Games" } },
    ...(credit ? { creditText: credit, creator: { "@type": "Organization", name: credit }, copyrightNotice: `© ${credit}` } : {}),
  };
  const media =
    item.kind === "video"
      ? {
          "@type": "VideoObject",
          ...common,
          thumbnailUrl: image ? [image.url] : undefined,
          contentUrl: absolute(item.original.url),
          embedUrl: page,
          duration: item.video ? isoDuration(item.video.duration) : undefined,
          width: item.width,
          height: item.height,
        }
      : item.kind === "audio"
        ? { "@type": "AudioObject", ...common, contentUrl: absolute(item.original.url), duration: item.audio ? isoDuration(item.audio.duration) : undefined, encodingFormat: item.original.mimeType }
        : {
            "@type": "ImageObject",
            ...common,
            contentUrl: image?.url ?? absolute(item.original.url),
            thumbnailUrl: thumb ? absolute(thumb.url) : undefined,
            width: image?.width ?? item.width,
            height: image?.height ?? item.height,
            caption: item.alt || item.title,
            encodingFormat: item.original.mimeType,
            ...(item.width ? { size: formatResolution(item.width, item.height) } : {}),
          };
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [...opts.crumbs, { name: item.title, href: `/media/${item.slug}` }].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absolute(c.href) })),
  };
  return { "@context": "https://schema.org", "@graph": [media, breadcrumbs] };
}

/** Sitewide: who we are and how to search the site (Google can show a search box for it). */
export function siteJsonLd(socials: string[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        name: SITE.name,
        alternateName: ["GTA Six Hub", "gtasixhub"],
        url: SITE.url,
        description: SITE.description,
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        logo: absolute("/brand/logo-480.webp"),
        sameAs: socials.filter(Boolean),
      },
    ],
  };
}
