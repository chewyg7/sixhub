"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

let registered = false;
if (typeof window !== "undefined" && !registered) {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.defaults({ ease: "expo.out", duration: 1 });
  registered = true;
}

/** Honour the OS setting and the site's own motion preference. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const pref = document.documentElement.dataset.motion;
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const EASE = {
  out: "expo.out",
  inOut: "expo.inOut",
  soft: "power3.out",
  spring: "elastic.out(1, 0.55)",
} as const;

export { gsap, ScrollTrigger, SplitText, useGSAP };
