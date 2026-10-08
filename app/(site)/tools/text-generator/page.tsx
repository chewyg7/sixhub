import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { TextGenerator } from "@/features/vi-text/text-generator";

export const metadata: Metadata = {
  title: "VI Text Generator",
  description: "Type any word and get it in the GTA VI title lettering. Pick a style and a background, then download it as a PNG.",
  alternates: { canonical: "/tools/text-generator" },
};

export default function TextGeneratorPage() {
  return (
    <Container wide>
      <PageHeader crumbs={[{ href: "/tools", label: "Tools" }, { label: "VI Text Generator" }]} title="VI Text Generator" lede="Type anything and get it in the GTA VI title lettering. Pick a style and a background, then download it as a PNG." />
      <TextGenerator />
      <p className="mt-12 text-[13px] text-white/35">
        Lettering engine based on the{" "}
        <a href="https://vi-text-generator.vercel.app" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white/70">
          VI Text Generator
        </a>{" "}
        by f3lixh. Grand Theft Auto VI artwork belongs to Rockstar Games.
      </p>
    </Container>
  );
}
