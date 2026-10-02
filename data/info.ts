import type { InfoEntry, InfoSection } from "@/types/content";

/**
 * Information database.
 *
 * Summaries are written by GTA 6 Hub from official Rockstar sources and
 * link back to them. Sections without verified entries yet (vehicles,
 * weapons, businesses, editions) render an empty state plus live related
 * coverage instead of speculative content.
 */
export const INFO_SECTIONS: InfoSection[] = [
  { slug: "overview", title: "Game Overview", description: "The essentials: setting, protagonists, developer and platforms.", layout: "list", entryNoun: "article", order: 1 },
  {
    slug: "characters",
    title: "Characters",
    description: "Protagonists and the people around them, with every screenshot, trailer and story they appear in.",
    layout: "profiles",
    entryNoun: "character",
    newsQuery: "character",
    order: 2,
  },
  {
    slug: "locations",
    title: "Locations",
    description: "Regions of the state of Leonida and the media that shows them.",
    layout: "places",
    entryNoun: "location",
    newsQuery: "map",
    order: 3,
  },
  {
    slug: "trailers",
    title: "Trailers",
    description: "Every official trailer, with release dates and the frames taken from each.",
    layout: "list",
    entryNoun: "trailer",
    newsQuery: "trailer",
    order: 4,
  },
  {
    slug: "release",
    title: "Release Information",
    description: "The current release date and how it has changed.",
    layout: "list",
    entryNoun: "article",
    newsQuery: "release date",
    order: 5,
  },
  { slug: "platforms", title: "Platforms", description: "Systems Grand Theft Auto VI has been announced for.", layout: "list", entryNoun: "platform", newsQuery: "PC", order: 6 },
  { slug: "editions", title: "Editions", description: "Game editions and what each includes.", layout: "list", entryNoun: "edition", newsQuery: "edition", order: 7 },
  {
    slug: "vehicles",
    title: "Vehicles",
    description: "Cars, bikes, boats and aircraft confirmed in official media.",
    layout: "list",
    entryNoun: "vehicle",
    newsQuery: "vehicles",
    order: 8,
  },
  {
    slug: "businesses",
    title: "Businesses",
    description: "Brands, venues and businesses seen in official media.",
    layout: "list",
    entryNoun: "business",
    newsQuery: "business",
    order: 9,
  },
  { slug: "weapons", title: "Weapons", description: "Weapons confirmed in official media.", layout: "list", entryNoun: "weapon", newsQuery: "weapons", order: 10 },
];

const VI = { label: "Rockstar Games — Grand Theft Auto VI", url: "https://www.rockstargames.com/VI" };
const PEOPLE = { label: "Rockstar Games — official character profiles", url: "https://www.rockstargames.com/VI" };
const PLACES = { label: "Rockstar Games — official location profiles", url: "https://www.rockstargames.com/VI" };
const NEWSWIRE = { label: "Rockstar Newswire", url: "https://www.rockstargames.com/newswire" };
const REVIEWED = "2026-09-27";

type Draft = Omit<InfoEntry, "id" | "body" | "facts" | "relatedCharacters" | "relatedLocations" | "relatedCollections" | "sources" | "verification" | "lastReviewed"> &
  Partial<Pick<InfoEntry, "body" | "facts" | "relatedCharacters" | "relatedLocations" | "relatedCollections" | "sources" | "verification">>;

const entry = (d: Draft): InfoEntry => ({
  id: `${d.section}/${d.slug}`,
  body: [],
  facts: [],
  relatedCharacters: [],
  relatedLocations: [],
  relatedCollections: [],
  sources: [VI],
  verification: "official",
  lastReviewed: REVIEWED,
  ...d,
});

export const INFO_ENTRIES: InfoEntry[] = [
  /* Overview ------------------------------------------------------- */
  entry({
    slug: "grand-theft-auto-vi",
    section: "overview",
    name: "Grand Theft Auto VI",
    summary: "The next main entry in Rockstar Games' Grand Theft Auto series, set in the state of Leonida and its city, Vice City.",
    imageSlug: "gv-jason-and-lucia-01-landscape",
    facts: [
      { label: "Developer", value: "Rockstar Games" },
      { label: "Publisher", value: "Rockstar Games" },
      { label: "Setting", value: "State of Leonida, including Vice City" },
      { label: "Protagonists", value: "Lucia Caminos, Jason Duval" },
      { label: "Platforms", value: "PlayStation 5, Xbox Series X|S" },
      { label: "Release date", value: "November 19, 2026" },
    ],
    body: [
      {
        type: "paragraph",
        text: "Grand Theft Auto VI returns the series to Vice City, now part of a wider fictional state called Leonida. The story follows two protagonists, Lucia Caminos and Jason Duval.",
      },
      { type: "paragraph", text: "Rockstar confirmed the game was in development in February 2022 and revealed it with its first trailer in December 2023." },
    ],
    relatedCharacters: ["lucia-caminos", "jason-duval"],
    relatedLocations: ["vice-city"],
    relatedCollections: ["trailer-1", "trailer-2"],
    sources: [VI, NEWSWIRE],
  }),

  /* Characters ----------------------------------------------------- */
  entry({
    slug: "lucia-caminos",
    section: "characters",
    name: "Lucia Caminos",
    subtitle: "Protagonist",
    summary:
      "One of the game's two protagonists. Introduced in Trailer 1, her official profile covers her time in Leonida Penitentiary and her determination to build a better life.",
    imageSlug: "gv-lucia-caminos-01",
    facts: [
      { label: "Role", value: "Protagonist" },
      { label: "First appearance", value: "Trailer 1 (December 2023)" },
    ],
    relatedCharacters: ["jason-duval"],
    relatedLocations: ["vice-city"],
    relatedCollections: ["trailer-1", "trailer-2", "character-artwork"],
    newsQuery: "Lucia",
    sources: [PEOPLE],
  }),
  entry({
    slug: "jason-duval",
    section: "characters",
    name: "Jason Duval",
    subtitle: "Protagonist",
    summary:
      "One of the game's two protagonists. His official profile describes an upbringing around grifters and a stint in the army before he began working for drug runners in the Leonida Keys.",
    imageSlug: "gv-jason-duval-01",
    facts: [
      { label: "Role", value: "Protagonist" },
      { label: "Associated region", value: "Leonida Keys" },
    ],
    relatedCharacters: ["lucia-caminos", "brian-heder", "cal-hampton"],
    relatedLocations: ["leonida-keys"],
    relatedCollections: ["trailer-2", "character-artwork"],
    newsQuery: "Jason",
    sources: [PEOPLE],
  }),
  entry({
    slug: "cal-hampton",
    imageSlug: "gv-cal-hampton-landscape",
    section: "characters",
    name: "Cal Hampton",
    subtitle: "Associate of Jason",
    summary: "A friend and associate of Jason who, according to his profile, would rather stay at home listening in on Coast Guard radio than go out.",
    relatedCharacters: ["jason-duval"],
    relatedLocations: ["leonida-keys"],
    newsQuery: "Cal Hampton",
    sources: [PEOPLE],
  }),
  entry({
    slug: "brian-heder",
    imageSlug: "gv-brian-heder-landscape",
    section: "characters",
    name: "Brian Heder",
    subtitle: "Keys drug runner",
    summary: "A long-time drug runner in the Leonida Keys. Jason works for him.",
    relatedCharacters: ["jason-duval"],
    relatedLocations: ["leonida-keys"],
    newsQuery: "Brian Heder",
    sources: [PEOPLE],
  }),
  entry({
    slug: "boobie-ike",
    imageSlug: "gv-boobie-ike-landscape",
    section: "characters",
    name: "Boobie Ike",
    subtitle: "Vice City businessman",
    summary: "A Vice City local whose ventures include real estate, a strip club and the record label Only Raw Records.",
    relatedCharacters: ["dre-quan-priest", "real-dimez"],
    relatedLocations: ["vice-city"],
    newsQuery: "Boobie Ike",
    sources: [PEOPLE],
  }),
  entry({
    slug: "dre-quan-priest",
    imageSlug: "gv-drequan-priest-landscape",
    section: "characters",
    name: "Dre'Quan Priest",
    subtitle: "Only Raw Records",
    summary: "A hustler turned music executive connected to Only Raw Records and the rap duo Real Dimez.",
    relatedCharacters: ["boobie-ike", "real-dimez"],
    relatedLocations: ["vice-city"],
    newsQuery: "Dre'Quan",
    sources: [PEOPLE],
  }),
  entry({
    slug: "real-dimez",
    imageSlug: "gv-real-dimez-landscape",
    section: "characters",
    name: "Real Dimez",
    subtitle: "Rap duo",
    summary: "Bae-Luxe and Roxy, a Vice City rap duo connected to Only Raw Records.",
    relatedCharacters: ["dre-quan-priest", "boobie-ike"],
    relatedLocations: ["vice-city"],
    newsQuery: "Real Dimez",
    sources: [PEOPLE],
  }),
  entry({
    slug: "raul-bautista",
    imageSlug: "gv-raul-bautista-landscape",
    section: "characters",
    name: "Raul Bautista",
    subtitle: "Bank robber",
    summary: "A seasoned, confident bank robber who is always looking for talent for bigger scores.",
    relatedCharacters: ["jason-duval", "lucia-caminos"],
    newsQuery: "Raul Bautista",
    sources: [PEOPLE],
  }),

  /* Locations ------------------------------------------------------ */
  entry({
    slug: "vice-city",
    section: "locations",
    name: "Vice City",
    subtitle: "City",
    summary: "Leonida's largest city, returning to the series as the centerpiece of Grand Theft Auto VI.",
    imageSlug: "gv-vice-city-postcard-landscape",
    relatedCharacters: ["lucia-caminos", "boobie-ike", "real-dimez", "dre-quan-priest"],
    relatedLocations: ["leonida-keys"],
    newsQuery: "Vice City",
    sources: [PLACES],
  }),
  entry({
    slug: "leonida-keys",
    section: "locations",
    name: "Leonida Keys",
    subtitle: "Island chain",
    summary: "A chain of islands off the southern tip of Leonida, where Jason lives and works.",
    imageSlug: "gv-leonida-keys-postcard-landscape",
    relatedCharacters: ["jason-duval", "brian-heder", "cal-hampton"],
    relatedLocations: ["vice-city"],
    newsQuery: "Leonida Keys",
    sources: [PLACES],
  }),
  entry({
    slug: "grassrivers",
    section: "locations",
    name: "Grassrivers",
    subtitle: "Wetlands",
    summary: "A vast wetland region of Leonida.",
    imageSlug: "gv-grassrivers-postcard-landscape",
    relatedLocations: ["vice-city"],
    newsQuery: "Grassrivers",
    sources: [PLACES],
  }),
  entry({
    slug: "port-gellhorn",
    section: "locations",
    name: "Port Gellhorn",
    subtitle: "Port town",
    summary: "A faded port town on Leonida's coast.",
    imageSlug: "gv-port-gellhorn-postcard-landscape",
    newsQuery: "Port Gellhorn",
    sources: [PLACES],
  }),
  entry({
    slug: "ambrosia",
    section: "locations",
    name: "Ambrosia",
    subtitle: "Industrial town",
    summary: "An inland industrial area of Leonida built around a refinery.",
    imageSlug: "gv-ambrosia-postcard-landscape",
    newsQuery: "Ambrosia",
    sources: [PLACES],
  }),
  entry({
    slug: "mount-kalaga",
    section: "locations",
    name: "Mount Kalaga National Park",
    subtitle: "National park",
    summary: "A national park of forested hills and trails in Leonida.",
    imageSlug: "gv-kalaga-hi-res-artwork",
    newsQuery: "Mount Kalaga",
    sources: [PLACES],
  }),

  /* Trailers ------------------------------------------------------- */
  entry({
    slug: "trailer-1",
    section: "trailers",
    name: "Trailer 1",
    subtitle: "December 4, 2023",
    summary: "The game's reveal trailer, set to Tom Petty's “Love Is a Long Road”. It introduced Lucia, Vice City and a 2025 release window.",
    imageSlug: "gv-gta-vi-trailer-1-0057",
    facts: [
      { label: "Published", value: "December 4, 2023" },
      { label: "Music", value: "“Love Is a Long Road” — Tom Petty" },
    ],
    relatedCharacters: ["lucia-caminos", "jason-duval"],
    relatedLocations: ["vice-city"],
    relatedCollections: ["trailer-1"],
    newsQuery: "trailer 1",
  }),
  entry({
    slug: "trailer-2",
    section: "trailers",
    name: "Trailer 2",
    subtitle: "May 6, 2025",
    summary: "The second trailer, set to “Hot Together” by The Pointer Sisters, focusing on Jason and Lucia's story.",
    imageSlug: "gv-gta-vi-trailer-2-0244",
    facts: [
      { label: "Published", value: "May 6, 2025" },
      { label: "Music", value: "“Hot Together” — The Pointer Sisters" },
    ],
    relatedCharacters: ["jason-duval", "lucia-caminos"],
    relatedLocations: ["leonida-keys", "vice-city"],
    relatedCollections: ["trailer-2"],
    newsQuery: "trailer 2",
  }),

  /* Release -------------------------------------------------------- */
  entry({
    slug: "release-date",
    section: "release",
    name: "Release date",
    subtitle: "November 19, 2026",
    summary: "Grand Theft Auto VI is scheduled for release on November 19, 2026.",
    facts: [
      { label: "Current date", value: "November 19, 2026" },
      { label: "Original window", value: "2025 (announced December 2023)" },
    ],
    body: [
      {
        type: "list",
        items: [
          "December 2023 — Trailer 1 announces a 2025 release window.",
          "May 2, 2025 — release set for May 26, 2026.",
          "November 6, 2025 — release moved to November 19, 2026.",
        ],
      },
      { type: "note", text: "Dates are tracked on the timeline with links to each announcement." },
    ],
    newsQuery: "release date",
    sources: [NEWSWIRE],
  }),

  /* Platforms ------------------------------------------------------ */
  entry({
    slug: "playstation-5",
    section: "platforms",
    name: "PlayStation 5",
    summary: "Announced launch platform.",
    facts: [{ label: "Status", value: "Announced" }],
  }),
  entry({
    slug: "xbox-series",
    section: "platforms",
    name: "Xbox Series X|S",
    summary: "Announced launch platform.",
    facts: [{ label: "Status", value: "Announced" }],
  }),
];
