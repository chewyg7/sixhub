import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

const TOPICS = [
  { title: "Corrections", body: "Something in the database or a media record is wrong or out of date." },
  { title: "Media & rights", body: "Takedown requests or questions about media shown on the site." },
  { title: "Feedback", body: "Bugs, Media Viewer ideas or anything else." },
];

export default function ContactPage() {
  return (
    <Container className="max-w-[760px]">
      <PageHeader title="Contact" lede="Email is the fastest way to reach us. Include a link to the page you're writing about." />
      <a
        href={`mailto:${SITE.contactEmail}`}
        className="display text-[28px] underline decoration-border-strong underline-offset-8 transition-colors hover:decoration-text sm:text-[36px]"
      >
        {SITE.contactEmail}
      </a>
      <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-divider bg-divider sm:grid-cols-3">
        {TOPICS.map((t) => (
          <li key={t.title} className="bg-bg p-5">
            <p className="text-[14.5px] font-semibold">{t.title}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{t.body}</p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
