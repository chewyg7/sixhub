"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap, prefersReducedMotion } from "@/lib/motion";

const KEY = "gh:intro-seen";

function finish() {
  document.documentElement.dataset.introDone = "1";
  window.dispatchEvent(new Event("gh:intro-done"));
}

/**
 * First-visit intro: the logo lands with a spring, a sunset line draws
 * under it, then the screen splits open. Skipped on repeat visits in the
 * same session, for reduced motion, and inside the Media Viewer.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => {
    const el = root.current;
    const seen = (() => {
      try {
        return sessionStorage.getItem(KEY) === "1";
      } catch {
        return false;
      }
    })();
    if (!el || seen || prefersReducedMotion() || path.startsWith("/viewer")) {
      if (el) el.style.display = "none";
      finish();
      return;
    }
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    const logo = el.querySelector("[data-intro-logo]");
    const line = el.querySelector("[data-intro-line]");
    const halves = el.querySelectorAll("[data-intro-half]");
    // Hide rather than remove: React owns this node and its siblings.
    const tl = gsap.timeline({ onComplete: () => void (el.style.display = "none") });
    tl.fromTo(
      logo,
      { scale: 0.55, rotate: -10, opacity: 0, filter: "blur(12px)" },
      { scale: 1, rotate: 0, opacity: 1, filter: "blur(0px)", duration: 1.1, ease: "elastic.out(1, 0.6)" },
    )
      .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "expo.inOut" }, 0.25)
      .to(logo, { scale: 1.35, opacity: 0, filter: "blur(8px)", duration: 0.6, ease: "expo.in" }, 1.2)
      .to(line, { opacity: 0, duration: 0.3 }, 1.2)
      .add(finish, 1.35)
      .to(halves[0], { yPercent: -100, duration: 1, ease: "expo.inOut" }, 1.35)
      .to(halves[1], { yPercent: 100, duration: 1, ease: "expo.inOut" }, 1.35);
    return () => {
      tl.kill();
    };
    // Only on the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} aria-hidden className="intro pointer-events-none fixed inset-0 z-[2800]">
      <div data-intro-half className="absolute inset-x-0 top-0 h-1/2 bg-[#0b0910]" />
      <div data-intro-half className="absolute inset-x-0 bottom-0 h-1/2 bg-[#0b0910]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
        <img data-intro-logo src="/brand/logo-480.webp" alt="" width={480} height={335} className="w-[min(58vw,300px)] opacity-0" />
        <span data-intro-line className="mt-8 h-[3px] w-40 origin-left rounded-full bg-[image:var(--sunset)]" />
      </div>
    </div>
  );
}
