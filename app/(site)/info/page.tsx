import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container, PageHeader, SectionHeading } from "@/components/layout/page";
import { EntryCard } from "@/components/info/entry-card";
import { getAllMedia, getInfoEntries, getInfoEntry, getInfoSections } from "@/lib/content";
import { mediaForCharacter } from "@/lib/content/relations";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Information",
  description: "A database of Grand Theft Auto VI characters, locations, trailers, release information and more — linked to the media they appear in.",
  alternates: { canonical: "/info" },
};

export default async function InfoIndexPage() {
  const [sections, entries, media, overview] = await Promise.all([getInfoSections(), getInfoEntries(), getAllMedia(), getInfoEntry("overview", "grand-theft-auto-vi")]);
  const bySlug = new Map(media.map((m) => [m.slug, m]));
  const characters = entries.filter((e) => e.section === "characters");
  const count = (s: string) => entries.filter((e) => e.section === s).length;

  return (
    <Container>
      <PageHeader
        eyebrow="Database"
        title="Information"
        lede="Characters, places and the facts Rockstar has confirmed, each linked to the screenshots, trailers and news they appear in."
      />

      {overview && (
        <section aria-labelledby="overview-h" className="grid gap-8 rounded-2xl border border-divider bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Game overview</p>
            <h2 id="overview-h" className="display mt-2 text-[34px]">
              {overview.name}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{overview.summary}</p>
            <Link
              href="/info/overview/grand-theft-auto-vi"
              className="mt-5 inline-flex items-center gap-1 text-[13.5px] font-medium text-text hover:underline hover:underline-offset-4"
            >
              Read the overview <ChevronRight className="size-4" />
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-divider bg-divider">
            {overview.facts.map((f) => (
              <div key={f.label} className="bg-surface p-4">
                <dt className="eyebrow text-[10.5px]">{f.label}</dt>
                <dd className="mt-1 text-[14px] font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-16" aria-labelledby="chars-h">
        <SectionHeading id="chars-h" title="Characters" href="/info/characters" linkLabel="All characters" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {characters.slice(0, 6).map((e) => (
            <EntryCard key={e.id} entry={e} image={e.imageSlug ? bySlug.get(e.imageSlug) : undefined} mediaCount={mediaForCharacter(media, e.slug).length} />
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="sections-h">
        <h2 id="sections-h" className="display mb-5 text-[30px]">
          Browse the database
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-divider bg-divider sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <li key={s.slug} className="bg-bg">
              <Link href={`/info/${s.slug}`} className="group flex h-full flex-col justify-between gap-6 p-5 transition-colors hover:bg-surface">
                <div>
                  <p className="text-[16px] font-semibold">{s.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.description}</p>
                </div>
                <p className="flex items-center justify-between text-[12.5px] text-faint">
                  <span className="tabular">{count(s.slug) ? pluralize(count(s.slug), "entry", "entries") : "No verified entries yet"}</span>
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
      </section>
    </Container>
  );
}
