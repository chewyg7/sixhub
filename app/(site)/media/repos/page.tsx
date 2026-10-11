import type { Metadata } from "next";
import { Container } from "@/components/layout/page";
import { MyRepos } from "@/features/repos/my-repos";

export const metadata: Metadata = { title: "My repos", robots: { index: false, follow: false } };

export default function MyReposPage() {
  return (
    <Container>
      <MyRepos />
    </Container>
  );
}
