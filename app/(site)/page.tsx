import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import type { HomeSectionId, MediaItem } from "@/types/content";
import type { NewsPage } from "@/types/news";
import { Container, SectionHeading, UnderlineLink } from "@/components/layout/page";
import { Hero } from "@/components/home/hero";
import { FaqList } from "@/components/faq/faq-list";
import { Marquee } from "@/components/home/marquee";
import { NewsShowcase } from "@/components/home/news-showcase";
import { CastGrid } from "@/components/home/cast-grid";
import { RegionRow } from "@/components/home/region-row";
import { Trailers } from "@/components/home/trailers";
import { GalleryColumns } from "@/components/home/gallery-columns";
import { ToolsShowcase } from "@/components/home/tools-showcase";
import { DiscordBand } from "@/components/discord/discord-band";
import { Stagger } from "@/components/motion/reveal";
import { getAllMedia, getCollection, getFaq, getInfoEntries, getSettings, getTimeline } from "@/lib/content";
import { byNewest } from "@/lib/content/relations";
import { fetchRockstarIntel } from "@/lib/news/rockstarintel";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export const revalidate = 600;

async function latestNews(): Promise<NewsPage | null> {
  try {
    return await fetchRockstarIntel({ scope: "gta6", page: 1 });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const settings = await getSettings();
  const home = settings.home;
  const sections = settings.site.sections.filter((x) => x.enabled);
  const [all, entries, timeline, news, gallery, faq] = await Promise.all([
    getAllMedia(),
    getInfoEntries(),
    getTimeline(),
    latestNews(),
    getCollection(home.galleryCollection),
    getFaq(),
  ]);
  const bySlug = new Map(all.map((m) => [m.slug, m]));
  const images = all.filter((m) => m.kind === "image" && !m.original.hasAlpha);
  const tagged = (key: "characters" | "locations", slug: string) => all.filter((m) => m[key].includes(slug));

  const characters = entries
    .filter((e) => e.section === "characters")
    .map((entry) => {
      const image: MediaItem | undefined = (entry.imageSlug && bySlug.get(entry.imageSlug)) || images.filter((m) => m.characters.includes(entry.slug)).sort(byNewest)[0];
      return { entry, image };
    });

  const regions = entries
    .filter((e) => e.section === "locations")
    .map((entry) => ({
      entry,
      image: bySlug.get(`gv-${entry.slug}-hi-res-artwork`) ?? (entry.imageSlug ? bySlug.get(entry.imageSlug) : undefined),
      count: tagged("locations", entry.slug).length,
    }));

  const trailers = all.filter((m) => m.kind === "video" && m.source.origin === "trailer").sort(byNewest);
  const trailer = bySlug.get(home.playSlug) ?? trailers[0];
  const wall = (gallery?.mediaSlugs ?? []).flatMap((s) => bySlug.get(s) ?? []).slice(0, 24);
  const featuredFaq = faq.filter((f) => f.featured).slice(0, 6);
  const launchLabel = new Date(`${settings.release.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const events = [...timeline].reverse().slice(0, 4);

  const heading = (id: HomeSectionId) => sections.find((x) => x.id === id) ?? { kicker: "", title: "" };
  const marquee = settings.site.marquee.map((w) => w.replace("{date}", launchLabel));

  // Each block knows its own spacing; the site editor decides which appear and in what order.
  const blocks: Record<HomeSectionId, () => React.ReactNode> = {
    // Straight under the hero by default: the community is the thing to join.
    discord: () => (
      <Container wide className="mt-16 sm:mt-24">
        <DiscordBand />
      </Container>
    ),
    news: () => (
      <Container wide className="mt-24 sm:mt-32">
        <SectionHeading kicker={heading("news").kicker} title={heading("news").title} href="/news" linkLabel="All news" />
        <NewsShowcase initial={news} />
      </Container>
    ),
    cast: () => (
      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker={heading("cast").kicker} title={heading("cast").title} href="/info/characters" linkLabel="All characters" />
        <CastGrid cast={characters} />
      </Container>
    ),
    regions: () => (
      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker={heading("regions").kicker} title={heading("regions").title} href="/info/locations" linkLabel="All locations" />
        <RegionRow regions={regions} />
      </Container>
    ),
    trailers: () => (
      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker={heading("trailers").kicker} title={heading("trailers").title} href="/media/videos" linkLabel="All videos" />
        <Trailers trailers={trailers} />
      </Container>
    ),
    gallery: () =>
      wall.length > 0 && (
        <div className="mt-20 sm:mt-28">
          <GalleryColumns items={wall} total={images.length} />
        </div>
      ),
    tools: () => (
      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker={heading("tools").kicker} title={heading("tools").title} href="/tools" linkLabel="All tools" />
        <ToolsShowcase />
      </Container>
    ),
    timeline: () => (
      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker={heading("timeline").kicker} title={heading("timeline").title} href="/timeline" linkLabel="Full timeline" />
        <Stagger as="ol" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/timeline#${e.id}`}
                className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition-[background-color,border-color,transform] duration-500 hover:-translate-y-1 hover:border-accent/40 hover:bg-white/[0.06]"
              >
                <time dateTime={e.date} className="kicker">
                  {formatDate(e.date)}
                </time>
                <p className="display mt-4 text-[24px] leading-tight transition-colors group-hover:text-accent-text">{e.title}</p>
                <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-muted">{e.summary}</p>
              </Link>
            </li>
          ))}
        </Stagger>
        <div className="mt-10 lg:hidden">
          <UnderlineLink href="/timeline">Full timeline</UnderlineLink>
        </div>
      </Container>
    ),
    faq: () =>
      featuredFaq.length > 0 && (
        <Container wide className="mt-28 sm:mt-40">
          <SectionHeading kicker={heading("faq").kicker} title={heading("faq").title} href="/faq" linkLabel="All questions" />
          <FaqList items={featuredFaq} />
        </Container>
      ),
    marquee: () => marquee.length > 0 && <Marquee words={marquee} reverse className="mt-28 sm:mt-40" />,
  };

  return (
    <>
      <Hero release={settings.release} launchMode={settings.launchMode} trailer={trailer} />
      {sections.map((sec) => (
        <Fragment key={sec.id}>{blocks[sec.id]?.()}</Fragment>
      ))}
    </>
  );
}
