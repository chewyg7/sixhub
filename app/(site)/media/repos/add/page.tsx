import type { Metadata } from "next";
import { Container } from "@/components/layout/page";
import { RepoAdd } from "@/features/repos/repo-add";

export const metadata: Metadata = { title: "Shared repo", robots: { index: false, follow: false } };

export default async function AddRepoPage({ searchParams }: PageProps<"/media/repos/add">) {
  const { url } = await searchParams;
  const link = typeof url === "string" ? url.slice(0, 2048) : "";
  return (
    <Container>
      {/* Keyed so following one share link after another starts fresh. */}
      <RepoAdd key={link} url={link} />
    </Container>
  );
}
