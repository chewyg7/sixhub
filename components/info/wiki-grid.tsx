"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface WikiCard {
  title: string;
  href: string;
  /** Picture URL (the wiki's image server), if there is one. */
  image?: string;
  /** Small line under the name, e.g. "12 media". */
  note?: string;
}

const initials = (s: string) =>
  s
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Every entry in a section, searchable, as picture cards. */
export function WikiGrid({ items, shape, noun }: { items: WikiCard[]; shape: "portrait" | "landscape"; noun: string }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const shown = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;
  return (
    <div>
      <label className="relative mb-7 block max-w-md">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${items.length} ${noun}`}
          aria-label={`Search ${noun}`}
          className="h-12 w-full rounded-full border border-white/10 bg-white/[0.04] pr-4 pl-11 text-[15px] outline-none placeholder:text-white/35 focus:border-accent"
        />
      </label>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted">Nothing matches “{query}”.</p>
      ) : (
        <ul className={cn("grid gap-x-4 gap-y-7", shape === "portrait" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
          {shown.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="group block">
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-2xl border border-white/8 bg-surface transition-[border-color] duration-300 group-hover:border-accent/40",
                    shape === "portrait" ? "aspect-[3/4]" : "aspect-[16/10]",
                  )}
                >
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served by the wiki's image server
                    <img
                      src={i.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <span aria-hidden className="display-tight absolute bottom-3 left-4 text-[52px] text-surface-active transition-colors group-hover:text-border-strong">
                      {initials(i.title)}
                    </span>
                  )}
                </span>
                <span className="mt-2.5 block text-[15px] leading-tight font-semibold group-hover:text-accent-text">{i.title}</span>
                {i.note && <span className="mt-0.5 block text-[12.5px] text-muted">{i.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
