/**
 * Core content model for GTA 6 Hub.
 *
 * These types describe content independently of where it is stored. The
 * current build reads them from the local dataset in `data/`, but every
 * shape here maps cleanly onto a CMS document or relational table
 * (see lib/content/source.ts for the adapter boundary).
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
 * - `sample`:   development placeholder, not real GTA VI content
 */
export type Verification = "official" | "reported" | "sample";

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export type MediaKind = "image" | "video" | "audio";

export type MediaCategorySlug = "artwork" | "screenshots" | "videos" | "audio" | "logos" | "promotional";

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

export type InfoSectionSlug = "overview" | "characters" | "locations" | "vehicles" | "businesses" | "weapons" | "trailers" | "release" | "platforms" | "editions";

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
