/**
 * Editorial configuration for the homepage. Editors change what's featured
 * here (or, later, in the CMS) without touching components.
 */
export const HOME_FEATURE = {
  /** Media item played by the "Watch" action. */
  playSlug: "gta-vi-trailer-2",
  /** Opening slideshow: official artwork with a big title each. */
  heroSlides: [
    { slug: "gv-jason-and-lucia-01-landscape", title: "Leonida" },
    { slug: "gv-vice-city-hi-res-artwork", title: "Vice City" },
    { slug: "gv-jason-and-lucia-robbery-landscape", title: "No way back" },
    { slug: "gv-leonida-keys-hi-res-artwork", title: "The Keys" },
    { slug: "gv-grassrivers-hi-res-artwork", title: "Grassrivers" },
  ],
  /** Collection whose shots fill the scrolling gallery wall. */
  galleryCollection: "screenshots-may-2025",
  /** Still shown inside the Media Viewer mock. */
  viewerStill: "gv-gta-vi-trailer-2-0244",
};

/** Quick picks offered in the Media Viewer pitch. */
export const VIEWER_PICKS = ["gta-vi-trailer-2", "gv-gta-vi-trailer-1-0057", "gv-vice-city-hi-res-artwork", "gv-jason-and-lucia-motel-landscape"];

