import type { Metadata } from "next";
import { Container } from "@/components/layout/page";
import { RepoAdd } from "@/features/repos/repo-add";
import { pluralize } from "@/lib/format";
import { getRepoPreview } from "@/lib/repo-preview";

const linkOf = (url: string | string[] | undefined) => (typeof url === "string" ? url.slice(0, 2048) : "");

/** Shared repo links show the repo's own name, author and a picture when posted in Discord and elsewhere. */
export async function generateMetadata({ searchParams }: PageProps<"/media/repos/add">): Promise<Metadata> {
  const link = linkOf((await searchParams).url);
  const repo = link ? await getRepoPreview(link, { withPicture: false }) : null;
  const title = repo ? `${repo.name} by ${repo.author}` : "Shared repo";
  const description = repo ? repo.description || `${pluralize(repo.count, "item")} to browse on GTA 6 Hub.` : "A collection of GTA VI media, shared on GTA 6 Hub.";
  const image = { url: `/og/repo?url=${encodeURIComponent(link)}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function AddRepoPage({ searchParams }: PageProps<"/media/repos/add">) {
  const link = linkOf((await searchParams).url);
  return (
    <Container>
      {/* Keyed so following one share link after another starts fresh. */}
      <RepoAdd key={link} url={link} />
    </Container>
  );
}
