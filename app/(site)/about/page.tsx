import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/layout/page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <Container className="max-w-[760px]">
      <PageHeader title="About" />
      <div className="prose-gh">
        <p>
          {SITE.name} is an independent archive for Grand Theft Auto VI. It collects official media in one searchable place, links every screenshot, trailer and artwork to the
          characters, locations and releases it relates to, and gives fans a proper tool for looking closely at it: the{" "}
          <Link href="/viewer" className="link-underline">
            Media Viewer
          </Link>
          .
        </p>
        <h2>Sources</h2>
        <p>
          Media and information come from Rockstar Games&apos; official channels and are credited on each page. News headlines are provided by{" "}
          <a href={SITE.newsSource.url} target="_blank" rel="noopener" className="link-underline">
            {SITE.newsSource.name}
          </a>{" "}
          through its public RSS feed; every story links to the original article.
        </p>
        <h2>Accuracy</h2>
        <p>
          Database entries only include what has been confirmed in official material, and each entry shows its source and when it was last reviewed. Press reports are labelled as
          reported. If you spot a mistake,{" "}
          <Link href="/contact" className="link-underline">
            let us know
          </Link>
          .
        </p>
        <h2>Not affiliated</h2>
        <p>
          {SITE.name} is a fan project. It is not affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two Interactive. All trademarks and copyrighted media belong
          to their respective owners.
        </p>
      </div>
    </Container>
  );
}
