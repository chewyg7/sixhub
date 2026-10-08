import Link from "next/link";
import type { MediaItem } from "@/types/content";
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
import { ViewerPromo } from "@/components/home/viewer-promo";
import { Stagger } from "@/components/motion/reveal";
import { getAllMedia, getCollection, getFaq, getInfoEntries, getMediaBySlugs, getSettings, getTimeline } from "@/lib/content";
import { byNewest } from "@/lib/content/relations";
import { fetchRockstarIntel } from "@/lib/news/rockstarintel";
import { formatDate } from "@/lib/format";

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
  const [all, entries, timeline, picks, news, gallery, faq] = await Promise.all([
    getAllMedia(),
    getInfoEntries(),
    getTimeline(),
    getMediaBySlugs(home.viewerPicks),
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
  const still = bySlug.get(home.viewerStill);
  const featuredFaq = faq.filter((f) => f.featured).slice(0, 6);
  const launchLabel = new Date(`${settings.release.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const events = [...timeline].reverse().slice(0, 4);

  return (
    <>
      <Hero release={settings.release} launchMode={settings.launchMode} trailer={trailer} />

      <Container wide className="mt-24 sm:mt-32">
        <SectionHeading kicker="RockstarINTEL" title="Latest news" href="/news" linkLabel="All news" />
        <NewsShowcase initial={news} />
      </Container>

      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker="The cast" title="Meet the people" href="/info/characters" linkLabel="All characters" />
        <CastGrid cast={characters} />
      </Container>

      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker="Leonida" title="Explore the state" href="/info/locations" linkLabel="All locations" />
        <RegionRow regions={regions} />
      </Container>

      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker="Official trailers" title="Watch it again" href="/media/videos" linkLabel="All videos" />
        <Trailers trailers={trailers} />
      </Container>

      {wall.length > 0 && (
        <div className="mt-20 sm:mt-28">
          <GalleryColumns items={wall} total={images.length} />
        </div>
      )}

      {still && (
        <Container wide className="mt-20 sm:mt-28">
          <ViewerPromo still={still} picks={picks} />
        </Container>
      )}

      <Container wide className="mt-28 sm:mt-40">
        <SectionHeading kicker="Milestones" title="The road to release" href="/timeline" linkLabel="Full timeline" />
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

      {featuredFaq.length > 0 && (
        <Container wide className="mt-28 sm:mt-40">
          <SectionHeading kicker="Questions" title="Good to know" href="/faq" linkLabel="All questions" />
          <FaqList items={featuredFaq} />
        </Container>
      )}

      <Marquee words={["Coming", launchLabel]} reverse className="mt-28 sm:mt-40" />
    </>
  );
}
