import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, PageHeader } from "@/components/layout/page";
import { Markdown } from "@/components/content/markdown";
import { getPage, listPages } from "@/lib/db/extras";

export function generateStaticParams() {
  return listPages({ published: true }).map((p) => ({ slug: p.slug }));
}

// Pages published in the admin panel after the build render on first visit.
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const page = getPage((await params).slug);
  if (!page?.published) return {};
  return { title: page.title, description: page.description || undefined, alternates: { canonical: `/p/${page.slug}` } };
}

export default async function CustomPage({ params }: PageProps<"/p/[slug]">) {
  const page = getPage((await params).slug);
  if (!page?.published) notFound();
  return (
    <Container className="max-w-[760px]">
      <PageHeader title={page.title} lede={page.description || undefined} />
      <Markdown source={page.body} />
    </Container>
  );
}
