"use client";

import { useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { gsap, SplitText, useGSAP, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";

const markDone = (el: Element | null) => el?.setAttribute("data-revealed", "");

/* ------------------------------------------------------------------ */
/* Split text                                                          */
/* ------------------------------------------------------------------ */
interface SplitRevealProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  by?: "chars" | "words" | "lines";
  delay?: number;
  stagger?: number;
  /** "scroll" animates when in view; "mount" immediately; "manual" waits for a `gh:intro-done` event. */
  when?: "scroll" | "mount" | "intro";
  id?: string;
}

/** Masked text reveal: each line/word/char rises out of its own mask. */
export function SplitReveal({ as: Tag = "h2", children, className, style, by = "words", delay = 0, stagger, when = "scroll", id }: SplitRevealProps) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) return markDone(el);
      const split = SplitText.create(el, {
        type: by === "chars" ? "lines,words,chars" : by === "words" ? "lines,words" : "lines",
        mask: "lines",
        linesClass: "split-line",
        autoSplit: true,
        onSplit(self) {
          markDone(el);
          const targets = by === "chars" ? self.chars : by === "words" ? self.words : self.lines;
          const tween = gsap.from(targets, {
            yPercent: 118,
            rotate: by === "chars" ? 8 : 2,
            duration: by === "chars" ? 1.1 : 1.25,
            ease: "expo.out",
            stagger: stagger ?? (by === "chars" ? 0.022 : by === "words" ? 0.05 : 0.1),
            delay,
            paused: when === "intro",
            scrollTrigger: when === "scroll" ? { trigger: el, start: "top 88%", once: true } : undefined,
          });
          if (when === "intro") {
            const go = () => tween.play();
            if (document.documentElement.dataset.introDone) go();
            else window.addEventListener("gh:intro-done", go, { once: true });
          }
          return tween;
        },
      });
      return () => split.revert();
    },
    { scope: ref, dependencies: [] },
  );
  return (
    <Tag ref={ref} id={id} data-reveal className={className} style={style}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Image reveal                                                        */
/* ------------------------------------------------------------------ */
/** Clip-path wipe with the image easing down from an overscale. */
export function RevealImage({
  children,
  className,
  from = "bottom",
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  from?: "bottom" | "left" | "center";
  delay?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) return markDone(el);
      markDone(el);
      const start = from === "left" ? "inset(0% 100% 0% 0%)" : from === "center" ? "inset(18% 18% 18% 18%)" : "inset(100% 0% 0% 0%)";
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 90%", once: true }, delay });
      tl.fromTo(el, { clipPath: start }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut" });
      const inner = el.querySelector("img, video");
      if (inner) tl.fromTo(inner, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: "expo.out" }, 0.1);
    },
    { scope: ref },
  );
  return (
    <div ref={ref} data-reveal className={cn("overflow-hidden", className)} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parallax                                                            */
/* ------------------------------------------------------------------ */
/** Scroll-scrubbed vertical drift. Positive speed moves against the scroll. */
export function Parallax({ children, speed = 0.15, className, scale }: { children: ReactNode; speed?: number; className?: string; scale?: [number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el,
        { yPercent: -speed * 50, scale: scale?.[0] ?? 1 },
        { yPercent: speed * 50, scale: scale?.[1] ?? 1, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true } },
      );
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staggered entrance                                                  */
/* ------------------------------------------------------------------ */
/** Direct children rise and fade in, one after another. */
export function Stagger({
  children,
  className,
  as: Tag = "div",
  y = 60,
  stagger = 0.08,
  start = "top 85%",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  y?: number;
  stagger?: number;
  start?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) return markDone(el);
      markDone(el);
      gsap.from(el.children, { y, opacity: 0, duration: 1.2, ease: "expo.out", stagger, scrollTrigger: { trigger: el, start, once: true } });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} data-reveal className={className}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic                                                            */
/* ------------------------------------------------------------------ */
/** Leans toward the cursor while hovered, springs back on leave. */
export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={cn("inline-block will-change-transform", className)}>
      {children}
    </div>
  );
}
