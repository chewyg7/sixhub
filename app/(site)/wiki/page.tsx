import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Container, PageHeader, SectionHeading } from "@/components/layout/page";
import { getInfoEntries, getInfoEntry, getInfoSections } from "@/lib/content";
import { pluralize } from "@/lib/format";
import { WIKI_LICENSE, WIKI_SECTIONS, displayName, imageUrl, isViFile, sectionMembers } from "@/lib/wiki/api";

export const metadata: Metadata = {
  title: "Wiki",
  description: "A database of Grand Theft Auto VI characters, locations, vehicles, weapons, businesses and more, with every screenshot, trailer and story they appear in.",
  alternates: { canonical: "/wiki" },
};

/** Who leads the characters row, before everyone else A–Z. */
const LEADS = ["Jason Duval", "Lucia Caminos"];
const rank = (title: string) => (LEADS.includes(title) ? LEADS.indexOf(title) : LEADS.length);

export default async function InfoIndexPage() {
  const [sections, entries, overview, wiki] = await Promise.all([
    getInfoSections(),
    getInfoEntries(),
    getInfoEntry("overview", "grand-theft-auto-vi"),
    Promise.all(WIKI_SECTIONS.map(async (s) => ({ section: s, members: await sectionMembers(s.slug) }))),
  ]);
  const wikiSlugs = new Set(WIKI_SECTIONS.map((s) => s.slug));
  const characters = (wiki.find((w) => w.section.slug === "characters")?.members ?? [])
    .filter((m) => m.image && isViFile(m.image))
    .sort((a, b) => rank(a.title) - rank(b.title))
    .slice(0, 12);
  // Sections written in the admin panel only (overview, trailers, release…).
  const own = sections.filter((s) => !wikiSlugs.has(s.slug));
  const ownCount = (s: string) => entries.filter((e) => e.section === s).length;
  const titleFor = (slug: string, fallback: string) => sections.find((s) => s.slug === slug)?.title ?? fallback;

  return (
    <Container>
      <PageHeader
        compact
        eyebrow="Database"
        title="Wiki"
        lede="Everyone and everything in GTA VI: characters, places, vehicles, weapons, businesses and more, linked to the screenshots, trailers and news they appear in."
      />

      {overview && (
        <section aria-labelledby="overview-h" className="grid gap-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Game overview</p>
            <h2 id="overview-h" className="display mt-2 text-[34px]">
              {overview.name}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{overview.summary}</p>
            <Link
              href="/wiki/overview/grand-theft-auto-vi"
              className="mt-5 inline-flex items-center gap-1 text-[13.5px] font-medium text-text hover:underline hover:underline-offset-4"
            >
              Read the overview <ChevronRight className="size-4" />
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-divider bg-divider">
            {overview.facts.map((f) => (
              <div key={f.label} className="bg-surface p-4">
                <dt className="eyebrow text-[10.5px]">{f.label}</dt>
                <dd className="mt-1 text-[14px] font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {characters.length > 0 && (
        <section className="mt-16" aria-labelledby="chars-h">
          <SectionHeading id="chars-h" title="Characters" href="/wiki/characters" linkLabel="All characters" />
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
            {characters.map((c) => (
              <li key={c.slug}>
                <Link href={`/wiki/characters/${c.slug}`} className="group block">
                  <span className="block aspect-[3/4] overflow-hidden rounded-2xl border border-white/8 bg-surface transition-[border-color] duration-300 group-hover:border-accent/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by the wiki's image server */}
                    <img src={imageUrl(c.image!, 480)} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </span>
                  <span className="mt-2 block text-[14.5px] leading-tight font-semibold group-hover:text-accent-text">{displayName(c.title)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16" aria-labelledby="sections-h">
        <h2 id="sections-h" className="display mb-6 text-[34px] sm:text-[44px]">
          Browse the database
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wiki.map(({ section, members }) => {
            const cover = members.find((m) => m.image && isViFile(m.image));
            return (
              <li key={section.slug}>
                <Link href={`/wiki/${section.slug}`} className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-[24px] border border-white/10 bg-surface p-5">
                  {cover?.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- served by the wiki's image server
                    <img
                      src={imageUrl(cover.image, 800)}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 size-full object-cover opacity-70 transition-[transform,opacity] duration-700 group-hover:scale-105 group-hover:opacity-90"
                    />
                  )}
                  <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(11_9_16/0.95),rgb(11_9_16/0.35)_55%,transparent)]" />
                  <span className="relative">
                    <span className="display block text-[28px] leading-none">{titleFor(section.slug, section.title)}</span>
                    <span className="mt-1.5 block text-[13.5px] leading-snug text-white/70">{section.description}</span>
                    <span className="tabular mt-3 flex items-center justify-between text-[12.5px] text-white/55">
                      {members.length ? pluralize(members.length, section.noun, section.plural) : "Loading from GTA Wiki"}
                      <ChevronRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <ul className="mt-4 grid gap-px overflow-hidden rounded-[24px] border border-divider bg-divider sm:grid-cols-2 lg:grid-cols-3">
          {own.map((s) => (
            <li key={s.slug} className="bg-bg">
              <Link href={`/wiki/${s.slug}`} className="group flex h-full flex-col justify-between gap-6 p-5 transition-colors hover:bg-surface">
                <div>
                  <p className="text-[16px] font-semibold">{s.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.description}</p>
                </div>
                <p className="flex items-center justify-between text-[12.5px] text-faint">
                  <span className="tabular">{ownCount(s.slug) ? pluralize(ownCount(s.slug), "entry", "entries") : "No verified entries yet"}</span>
                  <ChevronRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text" />
                </p>
              </Link>
            </li>
          ))}
          <li className="bg-bg">
            <Link href="/timeline" className="group flex h-full flex-col justify-between gap-6 p-5 transition-colors hover:bg-surface">
              <div>
                <p className="text-[16px] font-semibold">Timeline</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">Announcements, trailers and release-date changes in order.</p>
              </div>
              <ChevronRight className="size-4 self-end text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text" />
            </Link>
          </li>
        </ul>
        <p className="mt-6 flex items-center gap-1 text-[12.5px] text-faint">
          Characters, places and the rest come from
          <a href="https://gta.wiki" target="_blank" rel="noopener" className="wiki-link inline-flex items-center gap-0.5">
            GTA Wiki <ArrowUpRight className="size-3" />
          </a>
          ({WIKI_LICENSE.name}), GTA VI only.
        </p>
      </section>
    </Container>
  );
}
