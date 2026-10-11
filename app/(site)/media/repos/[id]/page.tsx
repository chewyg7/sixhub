import type { Metadata } from "next";
import { Container } from "@/components/layout/page";
import { RepoPage } from "@/features/repos/repo-page";

export const metadata: Metadata = { title: "Repo", robots: { index: false, follow: false } };

export default async function RepoRoute({ params }: PageProps<"/media/repos/[id]">) {
  const { id } = await params;
  return (
    <Container>
      <RepoPage id={id} />
    </Container>
  );
}
