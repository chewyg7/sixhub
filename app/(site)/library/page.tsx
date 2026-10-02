import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/layout/page";
import { LibraryView } from "@/features/library/library-view";
import { getAllMedia } from "@/lib/content";

export const metadata: Metadata = {
  title: "Your library",
  description: "Your favorites, personal collections and recently viewed media.",
  robots: { index: false },
};

export default async function LibraryPage() {
  const media = await getAllMedia();
  return (
    <Container>
      <PageHeader title="Your library" lede="Favorites, your own collections and recently viewed media. Stored privately in this browser — nothing is sent to a server." />
      <Suspense>
        <LibraryView media={media} />
      </Suspense>
    </Container>
  );
}
