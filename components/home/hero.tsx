"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { gsap, ScrollTrigger, SplitText, useGSAP, prefersReducedMotion } from "@/lib/motion";
import { smallestVariant, srcSetFor } from "@/lib/media/variants";
import { cn } from "@/lib/cn";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { useLightbox } from "@/components/media/lightbox-context";
import { viewerHref } from "@/components/media/media-links";

export interface HeroSlide {
  title: string;
  image: MediaItem;
}

const DURATION = 7;

/**
 * Cinematic opener: official artwork in wipe transitions with Ken Burns
 * drift, per-character title swaps, cursor depth parallax, and a scroll
 * push-in. Liquid glass holds the controls.
 */
export function Hero({ slides, trailer }: { slides: HeroSlide[]; trailer?: MediaItem }) {
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const current = useRef(0);
  const busy = useRef(false);
  const progress = useRef<gsap.core.Tween | null>(null);
  const splits = useRef<SplitText[]>([]);
  // Autoplay advances through this ref so `go` never references itself.
  const advance = useRef<(next: number) => void>(() => {});
  const { open } = useLightbox();

  const go = useCallback(
    (next: number) => {
      const el = root.current;
      if (!el || busy.current || next === current.current) return;
      const reduce = prefersReducedMotion();
      const prev = current.current;
      current.current = next;
      setIndex(next);
      busy.current = true;
      const slidesEls = el.querySelectorAll<HTMLElement>("[data-slide]");
      const titles = splits.current;
      const inEl = slidesEls[next];
      const outEl = slidesEls[prev];
      slidesEls.forEach((s, i) => (s.style.zIndex = i === next ? "3" : i === prev ? "2" : "1"));
      const tl = gsap.timeline({ onComplete: () => (busy.current = false) });
      tl.fromTo(inEl, { clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: reduce ? 0 : 1.45, ease: "expo.inOut" }, 0)
        .fromTo(inEl.querySelector("img"), { scale: 1.3, xPercent: 6 }, { scale: 1.08, xPercent: 0, duration: reduce ? 0 : 2.2, ease: "expo.out" }, 0)
        .to(outEl.querySelector("img"), { scale: 1.16, xPercent: -8, duration: reduce ? 0 : 1.45, ease: "expo.inOut" }, 0)
        .to(titles[prev]?.chars ?? [], { yPercent: -120, rotate: -6, duration: reduce ? 0 : 0.7, stagger: 0.018, ease: "expo.in" }, 0)
        .fromTo(
          titles[next]?.chars ?? [],
          { yPercent: 120, rotate: 8 },
          { yPercent: 0, rotate: 0, duration: reduce ? 0 : 1.2, stagger: 0.028, ease: "expo.out" },
          reduce ? 0 : 0.75,
        )
        .add(() => {
          gsap.to(inEl.querySelector("img"), { scale: 1, duration: DURATION + 2, ease: "none" });
        });
      progress.current?.kill();
      const bars = el.querySelectorAll<HTMLElement>("[data-progress]");
      bars.forEach((b, i) => gsap.set(b, { scaleX: i < next ? 1 : 0 }));
      progress.current = gsap.fromTo(bars[next], { scaleX: 0 }, { scaleX: 1, duration: DURATION, ease: "none", onComplete: () => advance.current((next + 1) % slides.length) });
    },
    [slides.length],
  );

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const reduce = prefersReducedMotion();
      splits.current = Array.from(el.querySelectorAll<HTMLElement>("[data-title]")).map((t) => SplitText.create(t, { type: "chars", mask: "chars" }));
      splits.current.forEach((s) => gsap.set(s.chars, { yPercent: 120 }));
      el.querySelectorAll<HTMLElement>("[data-title]").forEach((t) => (t.style.visibility = "visible"));

      const intro = gsap.timeline({ paused: true });
      intro
        .fromTo(el.querySelector("[data-slide] img"), { scale: 1.35 }, { scale: 1.08, duration: reduce ? 0 : 2.4, ease: "expo.out" }, 0)
        .to(splits.current[0]?.chars ?? [], { yPercent: 0, rotate: 0, duration: reduce ? 0 : 1.3, stagger: 0.035, ease: "expo.out" }, 0.25)
        .fromTo(el.querySelectorAll("[data-hero-ui]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: reduce ? 0 : 1.2, stagger: 0.08, ease: "expo.out" }, 0.55)
        .add(() => {
          gsap.to(el.querySelector("[data-slide] img"), { scale: 1, duration: DURATION + 2, ease: "none" });
          const bar = el.querySelector<HTMLElement>("[data-progress]");
          if (bar && slides.length > 1) progress.current = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: DURATION, ease: "none", onComplete: () => advance.current(1) });
        });
      const start = () => intro.play();
      if (document.documentElement.dataset.introDone) start();
      else window.addEventListener("gh:intro-done", start, { once: true });

      const cleanup = () => {
        window.removeEventListener("gh:intro-done", start);
        progress.current?.kill();
        splits.current.forEach((s) => s.revert());
      };
      if (reduce) return cleanup;

      gsap.to(el.querySelector("[data-hero-media]"), { scale: 1.12, yPercent: 12, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(el.querySelector("[data-hero-shade]"), { opacity: 0.85, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(el.querySelector("[data-hero-content]"), { yPercent: -35, opacity: 0, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "70% top", scrub: true } });

      const media = el.querySelector("[data-parallax]");
      const content = el.querySelector("[data-hero-titles]");
      const mx = gsap.quickTo(media, "x", { duration: 1.4, ease: "power3.out" });
      const my = gsap.quickTo(media, "y", { duration: 1.4, ease: "power3.out" });
      const tx = gsap.quickTo(content, "x", { duration: 1.1, ease: "power3.out" });
      const ty = gsap.quickTo(content, "y", { duration: 1.1, ease: "power3.out" });
      const onMove = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        mx(nx * -34);
        my(ny * -22);
        tx(nx * 18);
        ty(ny * 10);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => {
        window.removeEventListener("pointermove", onMove);
        cleanup();
      };
    },
    { scope: root },
  );

  useEffect(() => {
    advance.current = go;
  }, [go]);

  useEffect(() => {
    const onVis = () => (document.hidden ? progress.current?.pause() : progress.current?.resume());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    ScrollTrigger.refresh();
  }, []);

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="Featured artwork"
      className="relative -mt-24 h-[100svh] min-h-[640px] overflow-hidden bg-canvas text-white sm:-mt-28"
    >
      <div data-hero-media className="absolute inset-0 origin-top will-change-transform">
        <div data-parallax className="absolute -inset-[5%]">
          {slides.map((s, i) => {
            const v = smallestVariant(s.image, 1920);
            return (
              <div
                key={s.image.slug}
                data-slide
                className="absolute inset-0 overflow-hidden"
                style={{ zIndex: i === 0 ? 3 : 1, clipPath: i === 0 ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 0% 100%)", backgroundColor: s.image.dominantColor ?? undefined }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- responsive variants via srcset */}
                <img
                  src={v?.url}
                  srcSet={srcSetFor(s.image)}
                  sizes="110vw"
                  alt={i === index ? s.image.alt : ""}
                  fetchPriority={i === 0 ? "high" : "low"}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="size-full scale-[1.08] object-cover will-change-transform"
                />
              </div>
            );
          })}
        </div>
        <div data-hero-shade className="pointer-events-none absolute inset-0 z-[5] bg-bg opacity-0" />
        <div className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(to_top,rgb(11_9_16)_2%,rgb(11_9_16/0.55)_28%,transparent_58%),linear-gradient(to_right,rgb(11_9_16/0.55),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-48 bg-gradient-to-b from-black/50 to-transparent" />
      </div>

      <div data-hero-content className="absolute inset-0 z-10 mx-auto flex max-w-[1600px] flex-col justify-end px-5 pb-8 sm:px-8 sm:pb-10 lg:px-12">
        <div data-hero-titles className="relative">
          <div className="relative h-[17vw] min-h-[72px] sm:h-[11vw] lg:h-[144px]">
            {slides.map((s, i) => (
              <h1
                key={s.title + i}
                data-title
                aria-hidden={i !== index}
                className="display-xl absolute inset-x-0 bottom-0 text-[17vw] whitespace-nowrap text-white drop-shadow-[0_10px_40px_rgb(0_0_0/0.35)] sm:text-[11vw] lg:text-[142px]"
                style={{ visibility: "hidden" }}
              >
                {s.title}
              </h1>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div data-hero-ui className="flex flex-wrap items-center gap-3">
            {trailer && (
              <button
                type="button"
                onClick={() => open([trailer], 0)}
                data-cursor="play"
                className="group flex h-12 items-center gap-3 rounded-full bg-[image:var(--sunset)] pr-6 pl-1.5 text-[15px] font-bold shadow-[0_14px_44px_-12px_rgb(255_79_163/0.9)] transition-transform duration-500 ease-[var(--ease-out)] hover:scale-[1.04] active:scale-[0.97]"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#0b0910] transition-transform duration-500 group-hover:rotate-[360deg]">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
                Watch {trailer.title}
              </button>
            )}
            {trailer && (
              <LiquidGlass
                as={Link}
                href={viewerHref(trailer.slug)}
                radius={24}
                bezel={14}
                thickness={26}
                className="flex h-12 items-center px-6 text-[15px] font-bold text-white transition-transform duration-500 hover:scale-[1.03]"
              >
                Frame by frame
              </LiquidGlass>
            )}
          </div>

          <div data-hero-ui className="self-start sm:self-auto">
            <LiquidGlass elevated radius={20} bezel={14} thickness={28} className="flex items-center px-2 py-1">
              {slides.map((s, i) => (
                <button
                  key={s.image.slug}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${s.title}`}
                  aria-current={i === index}
                  className="group flex h-10 w-11 items-center px-1.5 sm:w-14"
                >
                  <span className={cn("h-[3px] w-full overflow-hidden rounded-full transition-colors", i === index ? "bg-white/30" : "bg-white/15 group-hover:bg-white/30")}>
                    <span data-progress className="block h-full origin-left scale-x-0 rounded-full bg-white" />
                  </span>
                </button>
              ))}
            </LiquidGlass>
          </div>
        </div>
      </div>
    </section>
  );
}
