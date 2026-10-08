"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { prefersLofi } from "@/lib/preferences";

const LOGO = "/brand/logo-480.webp";

/**
 * The header logo. On hover it leans a few pixels towards the cursor (and
 * springs back on leave), lifts slightly, picks up a soft pink glow, and a
 * light sheen sweeps across the mark itself (masked to the logo's shape).
 */
export function NavLogo() {
  const link = useRef<HTMLAnchorElement>(null);
  const art = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = link.current;
    const a = art.current;
    if (!el || !a || prefersReducedMotion() || prefersLofi() || !matchMedia("(pointer: fine)").matches) return;
    const x = gsap.quickTo(a, "x", { duration: 0.6, ease: "power3.out" });
    const y = gsap.quickTo(a, "y", { duration: 0.6, ease: "power3.out" });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x(((e.clientX - r.left) / r.width - 0.5) * 8);
      y(((e.clientY - r.top) / r.height - 0.5) * 6);
    };
    const onLeave = () => gsap.to(a, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.45)", overwrite: true });
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <Link ref={link} href="/" aria-label="GTA 6 Hub — home" className="nav-logo group relative flex shrink-0 items-center" data-cursor="link">
      <span aria-hidden className="nav-logo-glow" />
      {/* GSAP moves the outer span, CSS lifts the inner one, so they never fight. */}
      <span ref={art} className="relative block">
        <span className="nav-logo-art relative block">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src={LOGO} alt="GTA 6 Hub" width={480} height={335} className="block h-[45px] w-auto" />
          <span aria-hidden className="nav-logo-sheen" style={{ maskImage: `url(${LOGO})`, WebkitMaskImage: `url(${LOGO})` }} />
        </span>
      </span>
    </Link>
  );
}
