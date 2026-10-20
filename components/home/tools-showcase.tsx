import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Stagger } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";
import { TOOLS } from "@/lib/tools";

/** The fan tools on the home page: the first one large, the rest beside it. */
export function ToolsShowcase() {
  const [lead, ...rest] = TOOLS;
  return (
    <Stagger as="ul" className="grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-2">
      {[lead, ...rest].map((t, i) => (
        <li key={t.slug} className={cn(i === 0 && "lg:row-span-2")}>
          <Link
            href={t.href}
            data-cursor="view"
            data-cursor-label="Open"
            className="group relative flex h-full min-h-[300px] flex-col justify-end overflow-hidden rounded-[32px] border border-white/10 bg-[#0d0a12] p-6 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-accent/40 sm:p-8"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- tool preview */}
            <img
              src={t.image}
              alt=""
              loading="lazy"
              className={cn(
                "absolute transition-transform duration-700",
                t.slug === "text-generator"
                  ? "inset-x-0 top-[12%] m-auto h-[45%] w-auto object-contain group-hover:scale-110"
                  : "inset-0 size-full object-cover opacity-80 group-hover:scale-105",
              )}
            />
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(13_10_18)_8%,rgb(13_10_18/0.55)_45%,transparent_75%)]" />
            <span className="relative flex items-end justify-between gap-4">
              <span className="min-w-0">
                <span className={cn("display block leading-none", i === 0 ? "text-[38px] sm:text-[52px]" : "text-[30px]")}>{t.name}</span>
                <span className={cn("mt-2 block leading-relaxed text-white/70", i === 0 ? "max-w-md text-[16px]" : "text-[14.5px]")}>{i === 0 ? t.description : t.blurb}</span>
              </span>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors duration-500 group-hover:bg-[image:var(--sunset)]">
                <ArrowUpRight className="size-5" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </Stagger>
  );
}
