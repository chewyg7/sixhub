"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

const Ctx = createContext<Lenis | null>(null);
export const useLenis = () => useContext(Ctx);

/**
 * Inertia smooth scrolling (Lenis) driven by GSAP's ticker so ScrollTrigger
 * animations stay in lockstep. Disabled in the Media Viewer (app layout,
 * native scroll containers) and for reduced motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const enabled = !path.startsWith("/viewer");

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 1, allowNestedScroll: true, anchors: { offset: -90 }, autoRaf: false });
    l.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => l.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add("lenis-on");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the instance only exists once the effect has run
    setLenis(l);
    return () => {
      gsap.ticker.remove(raf);
      l.destroy();
      document.documentElement.classList.remove("lenis-on");
      setLenis(null);
    };
  }, [enabled]);

  // New route: start at the top and let ScrollTrigger re-measure.
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(t);
  }, [path, lenis]);

  // Pause smooth scroll while a modal locks the body.
  useEffect(() => {
    if (!lenis) return;
    const mo = new MutationObserver(() => (document.body.style.overflow === "hidden" ? lenis.stop() : lenis.start()));
    mo.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, [lenis]);

  return <Ctx.Provider value={lenis}>{children}</Ctx.Provider>;
}
