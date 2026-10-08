"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import type { MediaItem, SiteSettings } from "@/types/content";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/motion";
import { useLightbox } from "@/components/media/lightbox-context";
import { LaunchClock } from "@/components/launch/launch-clock";
import { useLaunchState } from "@/components/launch/use-launch";
import { fireConfetti } from "@/components/launch/confetti";
import { cn } from "@/lib/cn";

const BG_BLUR =
  "data:image/webp;base64,UklGRnwAAABXRUJQVlA4IHAAAAAQBACdASoYAA0APu1iqU2ppaQiMAgBMB2JYgCdIExDAoOzjQ+E9kiwoAD+ozFAuu5gUCa3Kp+hJgE54r75zBQrqy0+jG0Vh/vJGAwfCqgiKZw0av/4kuCXyQcOZ/Hqa6RWgUZ0txdCZ2h9i3DEEAAA";

/** Format a YYYY-MM-DD date for display without time zone drift. */
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * The opener: Jason and Lucia stand in front of the VI mark, in front of a
 * Leonida gas station at dusk. Each layer moves at its own depth with the
 * cursor and on scroll; the live countdown sits in liquid glass in front.
 */
const noop = () => () => {};

export function Hero({ release, launchMode, trailer }: { release: SiteSettings["release"]; launchMode: SiteSettings["launchMode"]; trailer?: MediaItem }) {
  const root = useRef<HTMLElement>(null);
  // `?launch=preview` shows the launch celebration early (read in the browser so the page stays static).
  const preview = useSyncExternalStore(noop, () => new URLSearchParams(location.search).get("launch") === "preview", () => false);
  const state = useLaunchState(release, launchMode, preview);
  const launched = !!state?.launched;
  const { open } = useLightbox();

  // Intro, cursor depth and scroll parallax.
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = (s: string) => el.querySelector<HTMLElement>(s);
      const bg = q("[data-layer=bg]");
      const mark = q("[data-layer=mark]");
      const fg = q("[data-layer=fg]");
      const ui = el.querySelectorAll("[data-hero-ui]");
      const reduce = prefersReducedMotion();

      const intro = gsap.timeline({ paused: true });
      intro
        .fromTo(bg, { scale: 1.28, filter: "blur(10px) brightness(0.6)" }, { scale: 1.06, filter: "blur(0px) brightness(1)", duration: reduce ? 0 : 2.2, ease: "expo.out" }, 0)
        .fromTo(mark, { scale: 0.55, rotate: -6, opacity: 0, filter: "blur(24px)" }, { scale: 1, rotate: 0, opacity: 1, filter: "blur(0px)", duration: reduce ? 0 : 1.8, ease: "expo.out" }, 0.2)
        .fromTo(fg, { yPercent: 22, opacity: 0, filter: "blur(12px)" }, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: reduce ? 0 : 1.7, ease: "expo.out" }, 0.38)
        .fromTo(ui, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: reduce ? 0 : 1.3, stagger: 0.09, ease: "expo.out" }, 0.75);
      const start = () => intro.play();
      if (document.documentElement.dataset.introDone) start();
      else window.addEventListener("gh:intro-done", start, { once: true });
      if (reduce) return () => window.removeEventListener("gh:intro-done", start);

      // Scroll: layers separate as the hero leaves.
      const st = { trigger: el, start: "top top", end: "bottom top", scrub: true } as const;
      gsap.to(bg, { yPercent: 14, ease: "none", scrollTrigger: st });
      gsap.to(mark, { yPercent: -55, opacity: 0.15, ease: "none", scrollTrigger: st });
      gsap.to(fg, { yPercent: 12, scale: 1.1, ease: "none", scrollTrigger: st });
      gsap.to(q("[data-hero-dock]"), { yPercent: -30, opacity: 0, ease: "none", scrollTrigger: { ...st, end: "60% top" } });

      // Idle breathing so the scene never sits still.
      gsap.to(q("[data-breathe]"), { y: -6, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });

      // Cursor depth: far layers drift a little, near layers more; the cutout also tilts.
      const to = (t: Element | null, p: string, d = 1.3) => gsap.quickTo(t, p, { duration: d, ease: "power3.out" });
      const bx = to(bg, "x");
      const by = to(bg, "y");
      const mx = to(mark, "x");
      const my = to(mark, "y");
      const fx = to(fg, "x", 1);
      const fy = to(fg, "y", 1);
      const ry = to(fg, "rotateY", 1.2);
      const rx = to(fg, "rotateX", 1.2);
      const glow = q("[data-glow]");
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        if (e.clientY > r.bottom) return;
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        bx(nx * -18);
        by(ny * -12);
        mx(nx * 26);
        my(ny * 14);
        fx(nx * 46);
        fy(ny * 16);
        ry(nx * 7);
        rx(ny * -4);
        glow?.style.setProperty("--gx", `${(nx + 0.5) * 100}%`);
        glow?.style.setProperty("--gy", `${(ny + 0.5) * 100}%`);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("gh:intro-done", start);
      };
    },
    { scope: root },
  );

  // Celebrate the first time the page sees the game as launched (once per session, always in preview).
  useEffect(() => {
    if (!launched) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem("gh:celebrated") === "1";
      sessionStorage.setItem("gh:celebrated", "1");
    } catch {}
    if (seen && !preview) return;
    let timer = 0;
    const go = () => (timer = window.setTimeout(() => fireConfetti(1.4), 700));
    if (document.documentElement.dataset.introDone) go();
    else window.addEventListener("gh:intro-done", go, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("gh:intro-done", go);
    };
  }, [launched, preview]);

  return (
    <section ref={root} aria-label="Grand Theft Auto VI" className="relative -mt-24 h-[100svh] min-h-[700px] overflow-hidden bg-[#2a1d4a] text-white [perspective:1400px] sm:-mt-28">
      {/* Background scene */}
      <div data-layer="bg" className="absolute -inset-[5%] will-change-transform" style={{ backgroundImage: `url(${BG_BLUR})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- layered artwork needs the exact files */}
        <img
          src="/hero/bg-2000.webp"
          srcSet="/hero/bg-1280.webp 1280w, /hero/bg-2000.webp 2000w"
          sizes="110vw"
          alt=""
          fetchPriority="high"
          className={cn("size-full object-cover object-[50%_62%] transition-[filter] duration-1000", launched && "saturate-[1.25]")}
        />
      </div>

      {/* Light that follows the cursor across the sky */}
      <div
        data-glow
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{ background: "radial-gradient(38rem 26rem at var(--gx, 60%) var(--gy, 40%), rgb(255 190 225 / 0.65), transparent 70%)" }}
      />
      <div aria-hidden className="hero-haze pointer-events-none absolute inset-x-0 bottom-[18%] h-[38%]" />

      {/* OUT NOW band behind the characters once the game is out */}
      {launched && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[36%] -rotate-3 overflow-hidden">
          <div className="hero-band flex w-max">
            {[0, 1].map((k) => (
              <span key={k} className="display-xl flex shrink-0 text-[24vw] leading-[0.82] whitespace-nowrap sm:text-[18vw]">
                {["Out now", "Out now", "Out now"].map((w, i) => (
                  <span key={i} className={cn("px-[3vw]", i % 2 ? "text-stroke" : "text-white/90")}>
                    {w}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* The VI mark, sandwiched between the scene and the characters */}
      <div
        data-layer="mark"
        aria-hidden
        className={cn(
          "absolute left-1/2 w-[min(84vw,560px)] -translate-x-1/2 will-change-transform lg:left-[42%] lg:w-[min(44vw,760px)] lg:-translate-x-[68%]",
          launched ? "top-[8%] lg:top-[6%]" : "top-[12%] lg:top-[12%]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- official mark */}
        <img src="/media/logos/gta-vi-mark/w960.webp" alt="" className="w-full drop-shadow-[0_30px_60px_rgb(40_10_60/0.45)]" />
      </div>

      {/* Jason & Lucia */}
      <div
        data-layer="fg"
        className="absolute bottom-0 left-1/2 h-[64svh] -translate-x-1/2 will-change-transform [transform-style:preserve-3d] sm:h-[70svh] lg:right-[8%] lg:left-auto lg:h-[94svh] lg:translate-x-0 xl:right-[11%]"
      >
        <div data-breathe className="h-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- layered artwork needs the exact files */}
          <img
            src="/hero/fg-1336.webp"
            srcSet="/hero/fg-900.webp 900w, /hero/fg-1336.webp 1336w"
            sizes="(min-width: 1024px) 64vh, 46vh"
            alt="Lucia and Jason, bandanas up, walking towards the camera"
            fetchPriority="high"
            className="h-full w-auto max-w-none drop-shadow-[0_40px_60px_rgb(20_8_30/0.55)]"
          />
        </div>
      </div>

      {/* Ground fade into the page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(to_top,var(--bg)_4%,rgb(11_9_16/0.6)_42%,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/35 to-transparent" />

      {/* Countdown dock */}
      <div data-hero-dock className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1600px] flex-col items-stretch px-4 pb-5 sm:px-8 sm:pb-9 lg:items-start lg:px-12">
        <div data-hero-ui className="mb-3 flex flex-wrap items-center gap-3">
          <p className="text-[14px] text-white/85 sm:text-[15px]">
            {longDate(release.date)} · {release.platforms.join(" & ")}
          </p>
          {trailer && (
            <button
              type="button"
              onClick={() => open([trailer], 0)}
              data-cursor="play"
              className="group inline-flex h-9 items-center gap-2 rounded-full bg-white/12 pr-4 pl-1 text-[13.5px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-[#140c18] transition-transform duration-500 group-hover:scale-110">
                <Play className="ml-0.5 size-3 fill-current" />
              </span>
              Watch {trailer.title}
            </button>
          )}
        </div>
        <div data-hero-ui className="w-full lg:w-auto">
          {state ? <LaunchClock state={state} className="w-full lg:w-auto" /> : <div className="h-[178px] w-full rounded-[30px] bg-white/5 lg:w-[560px]" />}
        </div>
      </div>
    </section>
  );
}
