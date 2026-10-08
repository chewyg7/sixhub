import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { FaqList } from "@/components/faq/faq-list";
import { SocialLinks } from "@/components/layout/social-links";
import { getFaq } from "@/lib/content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about Grand Theft Auto VI's release, launch times around the world, and GTA 6 Hub.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faq = await getFaq();
  const groups = [...new Set(faq.map((f) => f.group))];
  return (
    <Container>
      <PageHeader eyebrow="Questions & answers" title="FAQ" lede="Release dates, launch times around the world, and how to get the most out of the site." />
      <div className="grid gap-16 pb-10">
        {groups.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="kicker mb-4">
              {g}
            </h2>
            <FaqList items={faq.filter((f) => f.group === g)} />
          </section>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-start gap-5 rounded-[32px] border border-white/10 bg-white/[0.03] p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="display text-[26px]">Still have a question?</p>
          <p className="mt-1 text-[15px] text-muted">Ask the community on Discord, or follow along on X and Instagram.</p>
        </div>
        <SocialLinks />
      </div>
    </Container>
  );
}
