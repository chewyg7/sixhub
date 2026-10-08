"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";

/**
 * Living background: soft Vice-sunset light that drifts on its own and
 * chases the cursor with inertia, each layer at a different depth.
 */
export function AmbientBackground() {
  const path = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const hidden = path.startsWith("/viewer") || path.startsWith("/chewy");
  const { quality, motion } = usePreferences();

  useEffect(() => {
    const el = root.current;
    if (!el || hidden || quality === "lofi" || prefersReducedMotion()) return;
    const orbs = Array.from(el.querySelectorAll<HTMLElement>("[data-orb]"));
    const movers = orbs.map((o) => ({
      x: gsap.quickTo(o, "x", { duration: 2.4 + Number(o.dataset.depth) * 1.6, ease: "power3.out" }),
      y: gsap.quickTo(o, "y", { duration: 2.4 + Number(o.dataset.depth) * 1.6, ease: "power3.out" }),
      depth: Number(o.dataset.depth),
    }));
    const idle = orbs.map((o, i) =>
      gsap.to(o.firstElementChild, { xPercent: i % 2 ? 18 : -14, yPercent: i % 2 ? -12 : 16, scale: 1.15, duration: 9 + i * 3, repeat: -1, yoyo: true, ease: "sine.inOut" }),
    );
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      for (const m of movers) {
        m.x(nx * window.innerWidth * (0.22 + m.depth * 0.12));
        m.y(ny * window.innerHeight * (0.22 + m.depth * 0.12));
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      idle.forEach((t) => t.kill());
      gsap.set([...orbs, ...orbs.map((o) => o.firstElementChild)], { clearProps: "transform" });
    };
  }, [hidden, quality, motion]);

  if (hidden) return null;
  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div data-orb data-depth="0" className="absolute top-[-20%] left-[-10%] size-[70vmax]">
        <div className="size-full rounded-full bg-[radial-gradient(closest-side,rgb(228_69_184/0.22),transparent_70%)]" />
      </div>
      <div data-orb data-depth="1" className="absolute right-[-20%] bottom-[-30%] size-[80vmax]">
        <div className="size-full rounded-full bg-[radial-gradient(closest-side,rgb(255_79_163/0.16),transparent_70%)]" />
      </div>
      <div data-orb data-depth="2" className="absolute top-[30%] left-[35%] size-[45vmax]">
        <div className="size-full rounded-full bg-[radial-gradient(closest-side,rgb(255_138_115/0.12),transparent_70%)]" />
      </div>
      <div className="grain absolute inset-0 opacity-60" />
    </div>
  );
}
