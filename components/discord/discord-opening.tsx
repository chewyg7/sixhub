"use client";

import { useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";
import { prefersLofi } from "@/lib/preferences";

/**
 * The Discord band opens as you scroll to it: it unfolds from the top edge
 * (as if the page were parting), its text slides in from the left and the
 * button from the right. Tied to the scroll, so it plays back when you scroll
 * up. Nothing moves in LoFi or with reduced motion.
 */
export function DiscordOpening({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion() || prefersLofi()) return;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: el, start: "top 98%", end: "top 40%", scrub: 0.6 },
      });
      tl.fromTo(el, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, 0)
        .fromTo(el.querySelector("[data-open-shade]"), { opacity: 1 }, { opacity: 0.55, duration: 1 }, 0)
        .fromTo(el.querySelectorAll("[data-slide='left']"), { xPercent: -18, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.2)
        .fromTo(el.querySelectorAll("[data-slide='right']"), { xPercent: 22, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.8 }, 0.25);
    },
    { scope: root },
  );
  return (
    <section ref={root} aria-label="Join the GTA 6 Hub Discord" className={className}>
      {children}
    </section>
  );
}
