"use client";

import Link from "next/link";
import type { MediaItem } from "@/types/content";
import { smallestVariant } from "@/lib/media/variants";
import { pluralize } from "@/lib/format";
import { Stagger } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

export interface FolderCard {
  id: string;
  name: string;
  href: string;
  total: number;
  folders: number;
  previews: MediaItem[];
}

/** Three previews stacked like prints in a folder; they fan out on hover. */
function Stack({ previews }: { previews: MediaItem[] }) {
  const [a, b, c] = previews;
  const img = (m: MediaItem | undefined, cls: string) =>
    m ? (
      <span className={cn("absolute inset-0 overflow-hidden rounded-2xl shadow-[0_18px_40px_-18px_rgb(0_0_0/0.8)] ring-1 ring-white/10 transition-transform duration-700 ease-[var(--ease-out)]", cls)} style={{ backgroundColor: m.dominantColor ?? "#1c1424" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small preview variant */}
        <img src={smallestVariant(m, 480)?.url} alt="" loading="lazy" className={cn("size-full", m.original.hasAlpha ? "object-contain p-[10%]" : "object-cover")} />
      </span>
    ) : null;
  return (
    <span className="relative block aspect-[16/11]">
      {img(c, "translate-y-[-7%] scale-[0.86] opacity-70 group-hover:translate-x-[18%] group-hover:-translate-y-[10%] group-hover:rotate-[9deg]")}
      {img(b, "translate-y-[-3.5%] scale-[0.93] opacity-85 group-hover:-translate-x-[16%] group-hover:-translate-y-[7%] group-hover:-rotate-[7deg]")}
      {img(a, "group-hover:-translate-y-[3%] group-hover:scale-[1.03]")}
      {!a && <span className="absolute inset-0 rounded-2xl border border-dashed border-white/15" />}
    </span>
  );
}

export function FolderGrid({ folders, className }: { folders: FolderCard[]; className?: string }) {
  return (
    <Stagger as="ul" className={cn("grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {folders.map((f) => (
        <li key={f.id}>
          <Link href={f.href} data-cursor="view" data-cursor-label="Open" className="group block pt-3 outline-offset-8">
            <Stack previews={f.previews} />
            <span className="mt-4 flex items-baseline justify-between gap-3">
              <span className="display truncate text-[19px] text-text transition-colors group-hover:text-accent-text sm:text-[21px]">{f.name}</span>
              <span className="shrink-0 text-[13px] text-muted tabular-nums">{f.total.toLocaleString("en-US")}</span>
            </span>
            <span className="text-[13px] text-faint">{f.folders > 0 ? pluralize(f.folders, "folder") : pluralize(f.total, "item")}</span>
          </Link>
        </li>
      ))}
    </Stagger>
  );
}
