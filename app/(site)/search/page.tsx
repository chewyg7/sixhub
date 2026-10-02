import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/states";
import { SearchResults } from "@/features/search/search-results";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default function SearchPage() {
  return (
    <Container className="max-w-[900px]">
      <PageHeader title="Search" />
      <Suspense fallback={<Skeleton className="h-14 w-full rounded-xl" />}>
        <SearchResults />
      </Suspense>
    </Container>
  );
}
