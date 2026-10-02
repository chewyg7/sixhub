# GTA 6 Hub — gtasixhub.com

A GTA VI news site, searchable media archive and built-in **Media Viewer** for analyzing trailers, screenshots, artwork and audio.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Zustand (viewer state) · lucide-react (icons) · fast-xml-parser (RSS).

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run lint
```

> **Development dataset.** Every media file in `public/media/` is a procedurally generated, watermarked stand-in (`verification: "sample"`, labelled "Sample" in the UI). It exists so the archive, lightbox and Media Viewer can be exercised with real image/video/audio files and real metadata. Replace it with official media before launch (see _Replacing the sample media_). News is live — nothing in `/news` is invented.

---

## Project structure

```
app/                      Routes (App Router)
  (site)/                 Editorial pages with navbar + footer
    page.tsx              Home
    news/                 Live RSS news
    media/                Archive; /media/[slug] is a category OR an item
    collections/          Release & curated collections
    info/                 Database: /info, /info/[section], /info/[section]/[slug]
    timeline/  library/  search/  about/  contact/  privacy/
  (viewer)/viewer/        Full-height Media Viewer app
  api/news/               Server-side RSS proxy + parser (no CORS issues)
  api/search-index/       Static search documents for the client search engine
  sitemap.ts  robots.ts  icon.svg
components/
  ui/                     Primitives: button, tooltip, dialog, sheet, menu, popover, toast, controls, states
  layout/                 Navbar, footer, page scaffolding
  media/                  Cards, rail, grid, lightbox, zoomable image, players, tag list, metadata table
  news/  info/
features/
  media-viewer/           The viewer (see below)
  archive/                Archive query model (filter/facet/sort) + UI
  search/                 Search engine, command palette (⌘/Ctrl+K), results page
  news/                   Feed hooks and news UI
  library/                Favorites / personal collections / recently viewed
  timeline/
lib/
  content/                Content source abstraction + relationship engine
  news/                   RSS parsing + RockstarINTEL source
  format.ts  site.ts  preferences.ts  media/variants.ts  hooks/
data/                     Editorial content (media records, collections, info, timeline, categories, sources)
  generated/              Asset manifest written by the ingest script
types/                    Content and news models
scripts/                  generate-sample-assets.mjs (sample media pipeline)
```

## Content layer (CMS-ready)

Pages never import `data/` directly. They call `lib/content/index.ts`, which delegates to a `ContentSource` (`lib/content/source.ts`):

```ts
interface ContentSource {
  listMedia(); getMedia(slug);
  listCollections(); getCollection(slug);
  listInfoSections(); listInfoEntries(section?); getInfoEntry(section, slug);
  listTimeline();
}
```

The current implementation (`local-source.ts`) joins hand-written editorial records (`data/media.ts`) with the technical manifest produced by the ingest pipeline (`data/generated/sample-assets.json`). To move to **Sanity, Supabase/PostgreSQL, Directus, Strapi or a custom CMS**, implement `ContentSource` against that backend, map documents to the types in `types/content.ts`, and swap the export in `lib/content/index.ts`. Components are unaffected.

Core models: `MediaItem`, `Collection`, `InfoEntry` (`Character`, `Location` are typed entries), `InfoSection`, `TimelineEvent`, `NewsArticle`. Every record carries `verification: "official" | "reported" | "sample"` and sources.

### Relationships

`lib/content/relations.ts` is the relationship engine. Media items reference characters, locations, a source (e.g. _Trailer 2_) and collections; `mediaTags()` turns these into typed `TagRef`s and `tagHref()` routes each tag to "everything related": characters/locations → their database entry (which lists all tagged screenshots, videos, collections and live news), collections → the collection page, sources/types/tags → a filtered archive view. `relatedMedia()` scores shared characters, locations and collections to power every "Related media" section.

### Media files and performance

Each image item has an **original** plus pre-generated **display variants** (480/960/1920 px WebP) and a tiny blur placeholder. Cards and pages render `srcset` from variants only; the original loads only on demand (deep zoom in the lightbox/detail view, "View full resolution", Media Viewer, download). Videos have poster variants and a **storyboard sprite** for scrubber previews. Archive cards use `content-visibility` and incremental rendering; the lightbox and viewer are code-split.

## Replacing the sample media

1. Put official files through an ingest step that produces the same manifest shape (original + variants + blur + technical metadata). `scripts/generate-sample-assets.mjs` shows the pipeline (sharp for variants, ffmpeg for posters/storyboards/probing).
2. Replace `data/media.ts` records (title, description, alt text, dates, source, characters, locations, tags) and `data/collections.ts` membership, and set `verification: "official"`.
3. Delete `public/media/*` sample folders.

Regenerate samples: `node scripts/generate-sample-assets.mjs --force` (or `--only slug,slug`).

## News

`lib/news/rockstarintel.ts` fetches RockstarINTEL's WordPress RSS on the server (`/api/news`, and directly in server components), cached for 10 minutes. Supports pagination (`?paged=`), server-side search (`?s=`) and a GTA 6 category scope. The feed has no featured images, so Open Graph images are fetched in **one batched request per page** from the site's public WP REST API, with a fallback to the first editorial image in the article body. Cards show headline, excerpt, image, date and source, and link to the original story — articles are never rehosted.

## Media Viewer (`features/media-viewer`)

| Area | Implementation |
| --- | --- |
| State | `store.ts` (Zustand; layout prefs persisted) |
| Geometry | `lib/geometry.ts` — one matrix (translate · scale · rotate · flip) and its inverse drive zoom-around-cursor, pan, crop, navigator and pixel read-out, so every tool agrees under any rotation/flip |
| Playback | `controller.ts` — frame stepping seeks to the middle of the target frame; the presented frame comes from `requestVideoFrameCallback`; J/K/L shuttle (reverse emulated by seeking); linked B playback with offset |
| Frame rate | Archive metadata, else parsed from the file's MP4 `stts` box (`lib/mp4.ts`, works on local files and HTTP Range), else measured during playback |
| Capture/crop | `lib/capture.ts` — draws from the element at native `videoWidth`/`naturalWidth`, optional adjustments/rotation, PNG/JPEG/WebP, save/copy/open-as-image/pin-as-B |
| Adjustments | CSS filters + an SVG filter for exposure (linear gain) and sharpening (convolution); display-only |
| Compare | Side by side (optionally synced zoom), overlay (opacity, difference blend), slider |
| Sources | Archive items, local files (drag & drop, picker, paste), remote URLs (CORS fallback), captures |
| Shareable links | `lib/url-state.ts` — `?m=slug&t=12.345&z=4&x=…&y=…&r=90&b=slug&cm=slider` |
| Shortcuts | `shortcuts.ts` — a single table drives the key handler and the shortcuts dialog (`?`) |

Verified in development: stepping lands on the exact decoded frame (compared pixel-for-pixel against ffmpeg-extracted frames), and crop exports are pixel-identical to the source.

## Personal library

`features/library/store.ts` keeps favorites, user collections and recently viewed media behind a `LibraryAdapter` (localStorage today). An account-backed adapter can be set with `setLibraryAdapter()` without touching components.

## Configuration

- `NEXT_PUBLIC_SITE_URL` — canonical origin (defaults to `https://gtasixhub.com`).
- `lib/site.ts` — navigation, contact address, news source.
- `data/featured.ts` — homepage lead story, featured media and viewer quick picks.

## Content accuracy

Database entries and timeline events include only information confirmed in official Rockstar material, each with sources and a review date; press reports are marked `reported`. Sections without verified entries (vehicles, weapons, businesses, editions) show an honest empty state plus live related coverage. **Have an editor re-verify entries before launch.**
