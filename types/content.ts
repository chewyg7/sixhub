/**
 * Core content model for GTA 6 Hub.
 *
 * These types describe content independently of where it is stored. The
 * site reads them from the SQLite database (lib/db), which owners and admins
 * edit live from the admin panel; the files in `data/` only seed it.
 */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** ISO-8601 date (`2025-05-06`) or date-time (`2026-09-01T10:00:00Z`). */
export type ISODate = string;

export interface SourceLink {
  label: string;
  url: string;
}

/**
 * How much trust the site places in a record.
 * - `official`: stated by Rockstar Games / Take-Two in a linked source
 * - `reported`: reported by press, not confirmed by Rockstar
 * - `community`: made by the community (fan fonts, fan art), not Rockstar
 */
export type Verification = "official" | "reported" | "community";

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export type MediaKind = "image" | "video" | "audio" | "font";

/** Category slugs are open-ended: owners create new ones from the admin panel. */
export type MediaCategorySlug = string;

export interface MediaCategory {
  slug: MediaCategorySlug;
  label: string;
  singular: string;
  description: string;
  /** Display order in navigation and filters. */
  order: number;
}

export type MediaOrigin = "trailer" | "newswire" | "website" | "social" | "press" | "other";

/** Where a media item came from, e.g. "Trailer 2" or "Rockstar Newswire". */
export interface MediaSource {
  slug: string;
  label: string;
  origin: MediaOrigin;
  url?: string;
  date?: ISODate;
}

export interface ImageVariant {
  url: string;
  width: number;
  height: number;
  bytes?: number;
  format: "webp" | "avif" | "jpeg" | "png";
}

export interface MediaFile {
  url: string;
  mimeType: string;
  filename: string;
  bytes?: number;
  width?: number;
  height?: number;
  hasAlpha?: boolean;
}

export interface VideoTechnical {
  duration: number;
  fps: number;
  frameCount?: number;
  videoCodec?: string;
  /** RFC 6381 codec string, e.g. `avc1.640028`. */
  codecString?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  /** Overall bitrate in bits per second. */
  bitrate?: number;
}

export interface AudioTechnical {
  duration: number;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface FontTechnical {
  family: string;
  style: string;
  glyphs?: number;
  format: string;
}

/** Sprite sheet of evenly spaced frames used for scrubber previews. */
export interface Storyboard {
  url: string;
  /** Seconds between tiles. */
  interval: number;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  count: number;
}

/** A smaller encode of a video, for everyday playback. */
export interface VideoRendition {
  width: number;
  height: number;
  url: string;
  bytes?: number;
}

export interface MediaItem {
  id: string;
  slug: string;
  title: string;
  kind: MediaKind;
  category: MediaCategorySlug;
  description: string;
  /** Alternative text describing what is visible. Required for images. */
  alt: string;
  datePublished: ISODate;
  dateAdded: ISODate;
  source: MediaSource;
  /** Related official Rockstar page or post. */
  officialUrl?: string;
  width?: number;
  height?: number;
  original: MediaFile;
  /** Downscaled display variants (thumbnail → large). Never the original. */
  variants: ImageVariant[];
  poster?: MediaFile;
  blurDataUrl?: string;
  dominantColor?: string | null;
  video?: VideoTechnical;
  audio?: AudioTechnical;
  storyboard?: Storyboard;
  /** Lighter encodes of `original` (videos), largest first. The original stays the analysis source. */
  renditions?: VideoRendition[];
  font?: FontTechnical;
  /** Folder the item is filed in (see MediaFolder). */
  folderId?: string;
  tags: string[];
  /** Character entry slugs. */
  characters: string[];
  /** Location entry slugs. */
  locations: string[];
  /** Collection slugs (derived from collections, kept on the item for fast lookups). */
  collections: string[];
  downloadable: boolean;
  credit?: string;
  verification: Verification;
}

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export interface Collection {
  slug: string;
  title: string;
  kind: "release" | "curated";
  description: string;
  date?: ISODate;
  coverSlug: string;
  /** Ordered media slugs. */
  mediaSlugs: string[];
  sources: SourceLink[];
  /** Timeline event this collection belongs to, if any. */
  timelineEventId?: string;
}

/* ------------------------------------------------------------------ */
/* Information database                                                */
/* ------------------------------------------------------------------ */

/** Section slugs are open-ended: owners can add sections from the admin panel. */
export type InfoSectionSlug = string;

export interface InfoSection {
  slug: InfoSectionSlug;
  title: string;
  description: string;
  /** How entries are presented on the section page. */
  layout: "profiles" | "places" | "list";
  entryNoun: string;
  /** Query used to surface live related news coverage. */
  newsQuery?: string;
  order: number;
}

export interface InfoFact {
  label: string;
  value: string;
}

export type InfoBlock = { type: "paragraph"; text: string } | { type: "list"; items: string[] } | { type: "note"; text: string };

export interface InfoEntry {
  id: string;
  slug: string;
  section: InfoSectionSlug;
  name: string;
  subtitle?: string;
  summary: string;
  body: InfoBlock[];
  facts: InfoFact[];
  /** Media slug used as the entry's portrait / hero. */
  imageSlug?: string;
  relatedCharacters: string[];
  relatedLocations: string[];
  /** Media relationship is derived from `characters`/`locations` on media; these add explicit links. */
  relatedCollections: string[];
  newsQuery?: string;
  sources: SourceLink[];
  verification: Verification;
  lastReviewed: ISODate;
}

export type Character = InfoEntry & { section: "characters" };
export type Location = InfoEntry & { section: "locations" };

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export type TimelineEventType = "announcement" | "trailer" | "screenshots" | "newswire" | "release-date" | "marketing" | "financial";

export interface TimelineEvent {
  id: string;
  date: ISODate;
  datePrecision: "day" | "month" | "year";
  type: TimelineEventType;
  title: string;
  summary: string;
  sources: SourceLink[];
  collectionSlug?: string;
  mediaSlugs?: string[];
  newsQuery?: string;
  verification: Verification;
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

export type TagType = "character" | "location" | "source" | "category" | "kind" | "collection" | "tag";

/** A typed relationship that can be rendered as a clickable chip. */
export interface TagRef {
  type: TagType;
  value: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

/** A folder in the media archive. Items live in exactly one folder. */
export interface MediaFolder {
  id: string;
  /** `null` for top-level folders. */
  parentId: string | null;
  slug: string;
  name: string;
  description: string;
  /** Media slug used as the folder's cover image. */
  coverSlug?: string;
  sort: number;
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export interface FaqEntry {
  id: string;
  question: string;
  /** Plain text; blank lines separate paragraphs. */
  answer: string;
  group: string;
  sort: number;
  published: boolean;
  /** Also shown in the short FAQ at the bottom of the home page. */
  featured: boolean;
}

/* ------------------------------------------------------------------ */
/* Site settings (editable by owners)                                  */
/* ------------------------------------------------------------------ */

export interface SiteLink {
  label: string;
  href: string;
}

/** Home page blocks, in the order owners arrange them in the site editor. */
export type HomeSectionId = "news" | "cast" | "regions" | "trailers" | "gallery" | "viewer" | "timeline" | "faq" | "marquee";
export interface HomeSection {
  id: HomeSectionId;
  enabled: boolean;
  /** Small label above the heading (sections with a heading only). */
  kicker: string;
  title: string;
}

/** Everything the site editor controls. */
export interface SiteContent {
  /** Default page title and description for search engines and link previews. */
  title: string;
  description: string;
  sections: HomeSection[];
  /** Words in the scrolling band at the bottom of the home page; {date} becomes the release date. */
  marquee: string[];
  /** Links in the header bar. */
  nav: SiteLink[];
  /** Big links in the full-screen menu. */
  menu: SiteLink[];
  footer: { headline: string; tagline: string; ctaLabel: string; ctaHref: string };
}

export interface SiteSettings {
  release: {
    /** Calendar date (YYYY-MM-DD). The game unlocks at midnight local time in each time zone. */
    date: ISODate;
    platforms: string[];
  };
  /** Override for previewing or holding the launch celebration. */
  launchMode: "auto" | "launched" | "countdown";
  socials: { discord: string; x: string; instagram: string };
  announcement: { enabled: boolean; text: string; href: string };
  home: {
    playSlug: string;
    galleryCollection: string;
    viewerStill: string;
    viewerPicks: string[];
  };
  site: SiteContent;
  /** Covers the public site with a message (signed-in staff still see the site). */
  maintenance: { enabled: boolean; title: string; message: string };
}
