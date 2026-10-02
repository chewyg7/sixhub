"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bookmark, Menu as MenuIcon, Monitor, Moon, Search, Settings2, Sun } from "lucide-react";
import { PRIMARY_NAV, type NavItem } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useIsMac } from "@/lib/hooks/use-client";
import { setPreferences, usePreferences } from "@/lib/preferences";
import { useCommandPalette } from "@/features/search/command-palette";
import { buttonClass } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Menu } from "@/components/ui/menu";
import { Sheet } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { Wordmark } from "./wordmark";

function isActive(item: NavItem, path: string) {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function Navbar({ variant = "site" }: { variant?: "site" | "app" }) {
  const path = usePathname();
  const { open: openSearch } = useCommandPalette();
  const isMac = useIsMac();
  const prefs = usePreferences();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (variant === "app") return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  // Animated active indicator follows the active top-level link.
  useLayoutEffect(() => {
    const measure = () => {
      const el = linksRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      const box = linksRef.current?.getBoundingClientRect();
      const r = el?.getBoundingClientRect();
      setIndicator(el && box && r ? { left: r.left - box.left, width: r.width } : null);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [path]);

  const glass = variant === "app" || scrolled;

  return (
    <header
      className={cn(
        "top-0 z-50 w-full transition-[background-color,border-color,backdrop-filter] duration-200",
        variant === "app" ? "relative h-12 border-b border-divider bg-bg" : "sticky h-16 border-b",
        variant === "site" && (glass ? "glass-1 border-x-0 border-t-0 !shadow-none" : "border-transparent bg-transparent"),
      )}
    >
      <div className={cn("mx-auto flex h-full items-center gap-6", variant === "app" ? "px-3 sm:px-4" : "max-w-[1440px] px-4 sm:px-6 lg:px-10")}>
        <Wordmark />

        <nav aria-label="Primary" className="hidden flex-1 justify-center md:flex">
          <div ref={linksRef} className={cn("relative flex items-center gap-0.5 rounded-full p-1", variant === "site" && "glass-1")}>
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item, path);
              return (
                <div key={item.href} className="group/nav relative">
                  <Link
                    href={item.href}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative z-10 inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-200 lg:px-4",
                      active ? "text-text" : "text-muted hover:text-text",
                    )}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <div className="invisible absolute top-full left-0 z-10 pt-2 opacity-0 transition-[opacity,visibility,transform] delay-100 duration-150 group-focus-within/nav:visible group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:opacity-100">
                      <div className="glass-2 min-w-[230px] rounded-2xl p-2">
                        {item.children.map((c) => (
                          <Link
                            key={c.href}
                            href={c.href}
                            aria-current={path === c.href ? "page" : undefined}
                            className={cn(
                              "block rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors duration-100 hover:bg-surface-hover",
                              path === c.href ? "text-text" : "text-muted hover:text-text",
                            )}
                          >
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {indicator && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-1 rounded-full bg-[linear-gradient(100deg,rgb(249_186_214/0.22),rgb(255_185_148/0.16))] shadow-[inset_0_0_0_1px_rgb(244_162_197/0.3)] transition-[left,width] duration-300 ease-[var(--ease-out)]"
                style={{ left: indicator.left, width: indicator.width }}
              />
            )}
          </div>
        </nav>
        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openSearch()}
            className={buttonClass({
              variant: "ghost",
              size: "sm",
              className: "glass-1 hidden h-10 gap-2.5 rounded-full pr-2 pl-4 text-muted sm:inline-flex lg:w-52 lg:justify-start",
            })}
            aria-label="Search"
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
          >
            <Search />
            <span className="hidden flex-1 text-left lg:inline">Search</span>
            <span className="flex gap-0.5">
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <IconButton label="Search" onClick={() => openSearch()} className="sm:hidden">
            <Search />
          </IconButton>
          <Tooltip content="Your library">
            <Link
              href="/library"
              aria-label="Your library"
              aria-current={path === "/library" ? "page" : undefined}
              className={buttonClass({ variant: "ghost", size: "icon", className: path === "/library" ? "text-text" : undefined })}
            >
              <Bookmark />
            </Link>
          </Tooltip>
          <Menu
            align="end"
            minWidth={200}
            items={[
              { type: "label", label: "Theme" },
              { label: "Dark", checked: prefs.theme === "dark", onSelect: () => setPreferences({ theme: "dark" }) },
              { label: "Light", checked: prefs.theme === "light", onSelect: () => setPreferences({ theme: "light" }) },
              { label: "Match system", checked: prefs.theme === "system", onSelect: () => setPreferences({ theme: "system" }) },
              { type: "separator" },
              { type: "label", label: "Motion" },
              { label: "Match system", checked: prefs.motion === "system", onSelect: () => setPreferences({ motion: "system" }) },
              { label: "Reduce motion", checked: prefs.motion === "reduced", onSelect: () => setPreferences({ motion: "reduced" }) },
              { label: "Full motion", checked: prefs.motion === "full", onSelect: () => setPreferences({ motion: "full" }) },
            ]}
            trigger={(p) => (
              <Tooltip content="Display settings">
                <button {...p} type="button" aria-label="Display settings" className={buttonClass({ variant: "ghost", size: "icon" })}>
                  {prefs.theme === "light" ? <Sun /> : prefs.theme === "system" ? <Monitor /> : variant === "app" ? <Settings2 /> : <Moon />}
                </button>
              </Tooltip>
            )}
          />
          <IconButton label="Open menu" onClick={() => setMobileOpen(true)} className="md:hidden" aria-expanded={mobileOpen}>
            <MenuIcon />
          </IconButton>
        </div>
      </div>

      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" side="right">
        <nav aria-label="Mobile" className="flex flex-col gap-4 px-2 pb-8">
          {[{ href: "/", label: "Home" } as NavItem, ...PRIMARY_NAV].map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={path === item.href ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-[17px] font-semibold",
                  isActive(item, path) && item.href !== "/" ? "text-text" : path === item.href ? "text-text" : "text-muted",
                )}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="mt-0.5 grid grid-cols-2 gap-x-2">
                  {item.children.slice(1).map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn("rounded-md px-3 py-1.5 text-[13.5px]", path === c.href ? "text-text" : "text-muted")}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/library" onClick={() => setMobileOpen(false)} className="block rounded-md px-3 py-2 text-[17px] font-semibold text-muted">
            Your library
          </Link>
        </nav>
      </Sheet>
    </header>
  );
}
