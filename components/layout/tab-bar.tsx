"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Images, Menu, Newspaper, ScanSearch, Wand2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { LiquidGlass } from "@/components/glass/liquid-glass";

const TABS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" },
  { href: "/news", label: "News", icon: Newspaper, match: (p: string) => p.startsWith("/news") },
  { href: "/media", label: "Media", icon: Images, match: (p: string) => p.startsWith("/media") || p.startsWith("/collections") },
  { href: "/viewer", label: "Viewer", icon: ScanSearch, match: (p: string) => p.startsWith("/viewer") },
  { href: "/tools", label: "Tools", icon: Wand2, match: (p: string) => p.startsWith("/tools") },
];

/**
 * Phones and tablets: an app-style tab bar, a floating liquid-glass pill of
 * icons at the bottom of the screen (above the home indicator). The last
 * button opens and closes the full-screen menu.
 */
export function TabBar({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden">
      <LiquidGlass elevated radius={34} bezel={20} thickness={40} tint="rgb(16 10 20 / 0.58)" className="pointer-events-auto flex items-center gap-0.5 p-1.5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = !menuOpen && match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex size-[52px] items-center justify-center rounded-full transition-[background-color,color,transform] duration-300 active:scale-90",
                active ? "bg-white/[0.16] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]" : "text-white/60",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
              {active && <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-accent" />}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          className={cn(
            "ml-0.5 flex size-[52px] items-center justify-center rounded-full text-white transition-transform duration-300 active:scale-90",
            menuOpen ? "bg-white/[0.16]" : "bg-[image:var(--sunset)] shadow-[0_8px_24px_-8px_rgb(255_79_163/0.9)]",
          )}
        >
          {menuOpen ? <X className="size-[22px]" /> : <Menu className="size-[22px]" />}
        </button>
      </LiquidGlass>
    </nav>
  );
}
