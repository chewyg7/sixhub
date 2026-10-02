"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Endless band of giant condensed words. Drifts on its own; scroll speed
 * accelerates it and skews the letters in the direction of travel.
 */
export function Marquee({ words, className, reverse }: { words: string[]; className?: string; reverse?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      const track = el.querySelector<HTMLElement>("[data-track]");
      if (!track) return;
      const dir = reverse ? 1 : -1;
      const loop = gsap.to(track, { xPercent: dir * 50, duration: 38, ease: "none", repeat: -1 });
      if (reverse) gsap.set(track, { xPercent: -50 });
      const skew = gsap.quickTo(track, "skewX", { duration: 0.6, ease: "power3.out" });
      let settle = 0;
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onUpdate(self) {
          const v = self.getVelocity();
          gsap.to(loop, { timeScale: 1 + Math.min(6, Math.abs(v) / 350), duration: 0.25, overwrite: true });
          skew(gsap.utils.clamp(-12, 12, (v / 180) * -dir));
          window.clearTimeout(settle);
          settle = window.setTimeout(() => {
            gsap.to(loop, { timeScale: 1, duration: 1.4, ease: "power2.out", overwrite: true });
            skew(0);
          }, 120);
        },
      });
      return () => {
        window.clearTimeout(settle);
        st.kill();
        loop.kill();
      };
    },
    { scope: root },
  );
  const row = (hidden: boolean) =>
    words.map((w, i) => (
      <span key={`${w}${i}${hidden}`} aria-hidden={hidden || undefined} className="flex items-center">
        <span className={cn("display-xl px-6 sm:px-10", i % 2 ? "text-stroke" : "text-hot")}>{w}</span>
        <svg viewBox="0 0 24 24" className="size-[0.32em] shrink-0 text-accent" aria-hidden>
          <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor" />
        </svg>
      </span>
    ));
  return (
    <div ref={root} className={cn("overflow-hidden py-4 select-none", className)}>
      <div data-track className="flex w-max text-[22vw] leading-none will-change-transform sm:text-[15vw] lg:text-[170px]">
        <div className="flex">{row(false)}</div>
        <div className="flex">{row(true)}</div>
      </div>
    </div>
  );
}
