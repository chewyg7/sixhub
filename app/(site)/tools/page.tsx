import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container, PageHeader } from "@/components/layout/page";
import { Stagger } from "@/components/motion/reveal";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Tools",
  description: "Free GTA VI fan tools: a VI text generator and a wallpaper maker.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <Container wide>
      <PageHeader eyebrow="Make something" title="Tools" lede="Free tools for GTA VI fans and creators. Everything runs in your browser; nothing to sign up for." />
      <Stagger as="ul" className="grid gap-5 md:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.slug}>
            <Link
              href={t.href}
              data-cursor="view"
              data-cursor-label="Open"
              className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] transition-[border-color,transform,background-color] duration-500 hover:-translate-y-1 hover:border-accent/40 hover:bg-white/[0.05]"
            >
              <span className="relative block aspect-[16/9] overflow-hidden bg-[#0d0a12]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tool preview */}
                <img
                  src={t.image}
                  alt=""
                  className={
                    t.slug === "text-generator"
                      ? "absolute inset-0 m-auto h-1/2 w-auto object-contain transition-transform duration-700 group-hover:scale-110"
                      : "size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  }
                />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(14_11_20/0.7),transparent_55%)]" />
              </span>
              <span className="flex flex-1 flex-col p-6 sm:p-7">
                <span className="flex items-center justify-between gap-3">
                  <span className="display text-[26px]">{t.name}</span>
                  <ArrowUpRight className="size-5 text-white/40 transition-[transform,color] duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-text" />
                </span>
                <span className="mt-2 text-[15px] leading-relaxed text-white/60">{t.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </Stagger>
    </Container>
  );
}
