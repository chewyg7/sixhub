"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { useFocusTrap, lockScroll } from "@/lib/hooks/use-focus-trap";
import { useCommandPalette } from "@/features/search/command-palette";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { Countdown } from "@/components/home/countdown";
import { useSiteData } from "@/components/site-data";
import { SocialLinks } from "./social-links";

export interface MenuPreview {
  src: string;
  color: string | null;
}

const LINKS = [
  { href: "/news", label: "News", match: ["/news"] },
  { href: "/media", label: "Media", match: ["/media", "/collections"] },
  { href: "/viewer", label: "Viewer", match: ["/viewer"] },
  { href: "/info", label: "Leonida", match: ["/info"] },
  { href: "/timeline", label: "Timeline", match: ["/timeline"] },
];

const MENU = [
  { href: "/", label: "Home", preview: "home" },
  { href: "/news", label: "News", preview: "news" },
  { href: "/media", label: "Media", preview: "media" },
  { href: "/viewer", label: "Media Viewer", preview: "viewer" },
  { href: "/info/characters", label: "Characters", preview: "characters" },
  { href: "/info/locations", label: "Leonida", preview: "locations" },
  { href: "/timeline", label: "Timeline", preview: "timeline" },
];

const isActive = (match: string[], path: string) => match.some((m) => path === m || path.startsWith(`${m}/`));

export function SiteHeader({ previews }: { previews: Record<string, MenuPreview> }) {
  const path = usePathname();
  const { open: openSearch } = useCommandPalette();
  const [menuOpen, setMenuOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);

  // Hide on scroll down, reveal on scroll up.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let last = window.scrollY;
    let hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      const d = y - last;
      if (Math.abs(d) < 6) return;
      const hide = d > 0 && y > 160;
      if (hide !== hidden) {
        hidden = hide;
        gsap.to(el, { yPercent: hide ? -150 : 0, duration: hide ? 0.6 : 0.8, ease: "expo.out" });
      }
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Liquid pill that glides to the hovered (or active) link.
  const moveTo = useCallback((target: HTMLElement | null, instant = false) => {
    const p = pill.current;
    const n = nav.current;
    if (!p || !n) return;
    if (!target) return void gsap.to(p, { opacity: 0, scale: 0.9, duration: 0.35 });
    const nr = n.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    gsap.to(p, { x: r.left - nr.left, width: r.width, opacity: 1, scale: 1, duration: instant ? 0 : 0.55, ease: "expo.out" });
  }, []);
  const toActive = useCallback((instant = false) => moveTo(nav.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, instant), [moveTo]);
  useEffect(() => {
    const t = window.setTimeout(() => toActive(true), 60);
    document.fonts?.ready.then(() => toActive(true));
    return () => window.clearTimeout(t);
  }, [path, toActive]);

  // Close the menu when navigation lands on a new page.
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) {
    setMenuPath(path);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div ref={bar} className="pointer-events-auto mx-auto max-w-[1240px]">
          <LiquidGlass elevated radius={30} bezel={22} thickness={48} tint="rgb(16 10 20 / 0.2)" className="flex h-[68px] items-center gap-2 pr-2 pl-3 sm:pl-4">
            <Link href="/" aria-label="GTA 6 Hub — home" className="group flex shrink-0 items-center" data-cursor="link">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
              <img
                src="/brand/logo-480.webp"
                alt="GTA 6 Hub"
                width={480}
                height={335}
                className="h-[50px] w-auto transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.06] group-hover:-rotate-3"
              />
            </Link>

            <nav ref={nav} aria-label="Primary" className="relative mx-auto hidden items-center lg:flex" onPointerLeave={() => toActive()}>
              <span
                ref={pill}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-0 h-11 -translate-y-1/2 rounded-full bg-white/[0.09] opacity-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12),inset_1px_1px_0_rgb(255_255_255/0.25)]"
              />
              {LINKS.map((l) => {
                const active = isActive(l.match, path);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    onPointerEnter={(e) => moveTo(e.currentTarget)}
                    onFocus={(e) => moveTo(e.currentTarget)}
                    className={cn(
                      "relative z-10 flex h-11 items-center px-5 text-[15.5px] font-medium tracking-[0.01em] transition-colors duration-300",
                      active ? "text-white" : "text-white/65 hover:text-white",
                    )}
                  >
                    {l.label}
                    {active && <span aria-hidden className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
                  </Link>
                );
              })}
            </nav>
            <div className="flex-1 lg:hidden" />

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => openSearch()}
                aria-label="Search"
                className="flex size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Search className="size-[19px]" />
              </button>
              <Link
                href="/library"
                aria-label="Your library"
                className="hidden size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:flex"
              >
                <Bookmark className="size-[19px]" />
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-controls="site-menu"
                className="group flex h-11 items-center gap-3 rounded-full bg-[image:var(--sunset)] pr-5 pl-4 text-[15px] font-bold text-white shadow-[0_8px_30px_-8px_rgb(255_79_163/0.8)] transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]"
              >
                <span className="relative block h-3 w-5" aria-hidden>
                  <span
                    className={cn(
                      "absolute left-0 h-[2px] w-5 rounded-full bg-white transition-all duration-500 ease-[var(--ease-out)]",
                      menuOpen ? "top-[5px] rotate-45" : "top-0",
                    )}
                  />
                  <span
                    className={cn(
                      "absolute left-0 h-[2px] rounded-full bg-white transition-all duration-500 ease-[var(--ease-out)]",
                      menuOpen ? "top-[5px] w-5 -rotate-45" : "top-[10px] w-3 group-hover:w-5",
                    )}
                  />
                </span>
                {menuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </LiquidGlass>
        </div>
      </header>
      <FullscreenMenu open={menuOpen} onClose={() => setMenuOpen(false)} previews={previews} />
    </>
  );
}

function FullscreenMenu({ open, onClose, previews }: { open: boolean; onClose: () => void; previews: Record<string, MenuPreview> }) {
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string>("home");
  const path = usePathname();
  const { release } = useSiteData().settings;
  const releaseLabel = new Date(`${release.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  useFocusTrap(root, open);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const el = root.current;
    if (!mounted || !el) return;
    const reduce = prefersReducedMotion();
    if (open) {
      const unlock = lockScroll();
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", onKey);
      const tl = gsap.timeline();
      tl.fromTo(el, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: reduce ? 0 : 0.95, ease: "expo.inOut" })
        .fromTo(el.querySelectorAll("[data-menu-link]"), { yPercent: 115 }, { yPercent: 0, duration: reduce ? 0 : 1.1, stagger: 0.055, ease: "expo.out" }, reduce ? 0 : 0.35)
        .fromTo(el.querySelectorAll("[data-menu-fade]"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: reduce ? 0 : 0.9, stagger: 0.06 }, reduce ? 0 : 0.6);
      return () => {
        unlock();
        window.removeEventListener("keydown", onKey);
        tl.kill();
      };
    }
    gsap.to(el, { clipPath: "inset(0% 0% 0% 100%)", duration: reduce ? 0 : 0.75, ease: "expo.inOut", onComplete: () => setMounted(false) });
  }, [open, mounted, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={root}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="fixed inset-0 z-[45] overflow-hidden bg-[#0b0910] text-white"
      style={{ clipPath: "inset(0% 0% 100% 0%)" }}
    >
      {/* Artwork behind the links, cross-fading on hover */}
      {Object.entries(previews).map(([key, p]) => (
        <div
          key={key}
          aria-hidden
          className="absolute inset-0 transition-[opacity,transform] duration-[900ms] ease-[var(--ease-out)]"
          style={{ opacity: preview === key ? 0.42 : 0, transform: preview === key ? "scale(1)" : "scale(1.08)", backgroundColor: p.color ?? undefined }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- menu backdrop */}
          <img src={p.src} alt="" className="size-full object-cover" />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,#0b0910_20%,rgb(11_9_16/0.55)_60%,rgb(11_9_16/0.2))]" />

      <div className="relative mx-auto flex h-full max-w-[1240px] flex-col px-5 pt-32 pb-10 sm:px-8 lg:flex-row lg:items-end lg:gap-16 lg:pb-16">
        <nav aria-label="Menu" className="flex-1">
          <ul>
            {MENU.map((m, i) => (
              <li key={m.href} className="overflow-hidden">
                <Link
                  href={m.href}
                  data-menu-link
                  onPointerEnter={() => setPreview(m.preview)}
                  onFocus={() => setPreview(m.preview)}
                  onClick={onClose}
                  className={cn(
                    "group flex items-baseline gap-4 py-0.5 transition-[color,transform] duration-500 ease-[var(--ease-out)] hover:translate-x-4",
                    path === m.href ? "text-accent-text" : "text-white/90 hover:text-white",
                  )}
                >
                  <span className="w-8 text-[14px] font-medium text-white/40">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display-xl group-hover:text-hot text-[15vw] leading-[0.95] sm:text-[76px] lg:text-[92px]">{m.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-10 grid gap-8 lg:mt-0 lg:w-[340px]">
          <div data-menu-fade>
            <p className="text-[14px] text-white/60">Grand Theft Auto VI arrives</p>
            <p className="display mt-1 text-[26px]">{releaseLabel}</p>
            <div className="mt-4 -ml-3">
              <Countdown date={release.date} size="sm" />
            </div>
          </div>
          <SocialLinks className="-mt-2" size="sm" />
          <div data-menu-fade className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-white/70">
            {[
              ["Collections", "/collections"],
              ["FAQ", "/faq"],
              ["Your library", "/library"],
              ["About", "/about"],
              ["Contact", "/contact"],
            ].map(([l, h]) => (
              <Link key={h} href={h} onClick={onClose} className="transition-colors hover:text-white">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
