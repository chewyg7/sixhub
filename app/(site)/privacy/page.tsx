import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <Container className="max-w-[760px]">
      <PageHeader title="Privacy" lede="Short version: no accounts, no ads, no tracking cookies." />
      <div className="prose-gh">
        <h2>What stays in your browser</h2>
        <p>
          Favorites, personal collections, recently viewed media, recent searches and display settings are stored in your browser&apos;s local storage. They never leave your
          device, and clearing site data removes them.
        </p>
        <h2>Files you open in the Media Viewer</h2>
        <p>Local files you open in the Media Viewer are processed entirely in your browser and are never uploaded. Frame captures and crops are created on your device.</p>
        <h2>News</h2>
        <p>
          Headlines are fetched by our server from {SITE.newsSource.name}&apos;s public RSS feed. Article images load from the publisher&apos;s servers, and following a story takes
          you to their site, where their privacy policy applies.
        </p>
        <h2>Server logs</h2>
        <p>Our hosting provider keeps standard request logs (such as IP address and user agent) for security and reliability, retained for a limited time.</p>
        <h2>Contact</h2>
        <p>
          Questions:{" "}
          <a className="link-underline" href={`mailto:${SITE.contactEmail}`}>
            {SITE.contactEmail}
          </a>
        </p>
      </div>
    </Container>
  );
}
