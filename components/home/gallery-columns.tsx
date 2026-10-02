"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/motion";
import { smallestVariant, srcSetFor } from "@/lib/media/variants";
import { cn } from "@/lib/cn";
import { useLightbox } from "@/components/media/lightbox-context";
import { SplitReveal } from "@/components/motion/reveal";

const SPEEDS = [-14, 10, -22, 6];

/**
 * A wall of screenshots in columns that drift at different speeds while
 * scrolling, with a headline pinned over the middle. Tiles open the lightbox.
 */
export function GalleryColumns({ items, total }: { items: MediaItem[]; total: number }) {
  const root = useRef<HTMLElement>(null);
  const { open } = useLightbox();
  const columns = SPEEDS.map((_, c) => items.filter((_, i) => i % SPEEDS.length === c));

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      el.querySelectorAll<HTMLElement>("[data-col]").forEach((col, i) => {
        gsap.fromTo(col, { yPercent: SPEEDS[i] * -1 }, { yPercent: SPEEDS[i], ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
      gsap.fromTo(
        el.querySelector("[data-wall]"),
        { rotate: -4, scale: 1.12 },
        { rotate: 0, scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "center center", scrub: true } },
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="gallery-h" className="relative h-[150vh] min-h-[900px] overflow-clip">
      <div data-wall className="absolute inset-x-[-4%] -top-[10%] -bottom-[10%] grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {columns.map((col, c) => (
          <div key={c} data-col className={cn("flex flex-col gap-3 will-change-transform sm:gap-4", c > 1 && "max-md:hidden")}>
            {col.map((m) => {
              const index = items.indexOf(m);
              return (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => open(items, index)}
                  aria-label={`Open ${m.title}`}
                  data-cursor="view"
                  className="group relative block aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl"
                  style={{ backgroundColor: m.dominantColor ?? undefined }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- responsive variants via srcset */}
                  <img
                    src={smallestVariant(m, 480)?.url}
                    srcSet={srcSetFor(m)}
                    sizes="(min-width: 768px) 25vw, 50vw"
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-[1.2s] ease-[var(--ease-out)] group-hover:scale-110"
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(11_9_16/0.88),rgb(11_9_16/0.35)_60%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg to-transparent" />

      <div className="pointer-events-none sticky top-0 flex h-[100svh] flex-col items-center justify-center px-5 text-center">
        <p className="kicker mb-4">{total.toLocaleString("en-US")} official images, archived</p>
        <SplitReveal id="gallery-h" by="chars" className="display-xl text-[18vw] sm:text-[140px] lg:text-[190px]">
          <span className="text-accent">Every</span> frame
        </SplitReveal>
        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/75">Screenshots, artwork and trailer screencaps in full resolution. Click any tile to open it.</p>
        <Link
          href="/media"
          data-cursor="view"
          data-cursor-label="Browse"
          className="group pointer-events-auto mt-8 inline-flex h-14 items-center gap-3 rounded-full bg-[image:var(--sunset)] pr-2 pl-7 text-[16px] font-bold text-white shadow-[0_14px_44px_-12px_rgb(255_79_163/0.9)] transition-transform duration-500 hover:scale-[1.04]"
        >
          Browse the archive
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-[#0b0910] transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight className="size-5" />
          </span>
        </Link>
      </div>
    </section>
  );
}
