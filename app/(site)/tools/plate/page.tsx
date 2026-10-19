import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/page";
import { PlateCreator } from "@/features/plate/plate-creator";

export const metadata: Metadata = {
  title: "Leonida Plate Creator",
  description: "Design your own Leonida licence plate from GTA VI: type your text, pick a style and frame, then see it stamped in 3D and bolted to a car.",
  alternates: { canonical: "/tools/plate" },
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 40) : undefined);

export default async function PlatePage({ searchParams }: PageProps<"/tools/plate">) {
  const sp = await searchParams;
  return (
    <Container wide>
      <PageHeader
        crumbs={[{ href: "/tools", label: "Tools" }, { label: "Leonida Plate Creator" }]}
        title="Leonida Plate Creator"
        lede="Make it yours in the Goodtime State. Type your plate, pick a style, then flip to 3D to turn it in your hands or see it bolted to your ride."
      />
      <PlateCreator
        initial={{
          text: one(sp.text),
          style: one(sp.style),
          frame: one(sp.frame),
          paint: one(sp.paint),
          variation: one(sp.variation),
          split: one(sp.split),
          rounded: one(sp.rounded),
          colors: one(sp.colors),
          linked: one(sp.linked),
          at: one(sp.at),
          gap: one(sp.gap),
          track: one(sp.track),
          shift: one(sp.shift),
        }}
      />
    </Container>
  );
}
