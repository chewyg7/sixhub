import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { TimelineView } from "@/features/timeline/timeline-view";
import { getAllMedia, getCollections, getTimeline } from "@/lib/content";

export const metadata: Metadata = {
  title: "Timeline",
  description: "Every official Grand Theft Auto VI milestone: announcements, trailers, screenshot releases and release-date changes.",
  alternates: { canonical: "/timeline" },
};

export default async function TimelinePage() {
  const [events, collections, media] = await Promise.all([getTimeline(), getCollections(), getAllMedia()]);
  const neededMedia = new Set(collections.flatMap((c) => c.mediaSlugs.slice(0, 4)));
  return (
    <Container className="max-w-[1100px]">
      <PageHeader
        crumbs={[{ href: "/info", label: "Information" }, { label: "Timeline" }]}
        title="Timeline"
        lede="Official milestones with links to the announcement, the media released with it and related coverage."
      />
      <TimelineView
        events={events}
        collections={Object.fromEntries(collections.map((c) => [c.slug, c]))}
        media={Object.fromEntries(media.filter((m) => neededMedia.has(m.slug)).map((m) => [m.slug, m]))}
      />
    </Container>
  );
}
